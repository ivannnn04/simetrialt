"use server";

import { revalidatePath } from "next/cache";
import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { requireEditor } from "@/lib/auth";
import { slugify } from "@/lib/slug";
import { saveImage } from "@/lib/uploads";
import mammoth from "mammoth";
import { del } from "@vercel/blob";
import sharp from "sharp";
import { guessMapping, imageKeyCandidates, parsePriceCents, parseSpreadsheet, type Field } from "@/lib/catalogue-import";
import { extractPdfPages, parseFields, splitProducts, type PdfImage, type PdfLine, type PdfProduct } from "@/lib/catalogue-pdf";
import { aiEnabled, extractProductsFromText, matchPhotosToProducts, rankImageCandidates, structureProducts, type AiProductFields, type ImageCandidate } from "@/lib/ai";
import { imageSearchEnabled, searchImages } from "@/lib/image-search";
import { composeDescription, type Draft, type DraftItem, type PublishResult, type SubmitItem } from "@/lib/catalogue-wizard";
import { classify, SITE_CATEGORY_RE, siteCategorySlug } from "@/lib/taxonomy";
import { deriveVariant } from "@/lib/variants";
import { extractPriceListPdf, type PriceListRow } from "@/lib/pricelist-pdf";
import { disambiguateNames, productFromPriceRow } from "@/lib/pricelist-products";
import { looksLikeBrandList, matchBrand, parseBrandList, type BrandInfo } from "@/lib/brand-list";
import { mapConcurrent, matchProductPage, pageImages, siteUrls } from "@/lib/brand-site";
import { extractCatalogueFamilies, findFamily, type FamilyBlock } from "@/lib/catalogue-families";
import { extractBlockPriceList, type BlockRow } from "@/lib/pricelist-blocks";
import { extractSectionPriceList, extractTablePriceList } from "@/lib/pricelist-sections";
import { readCatalogueWithAI } from "@/lib/ai-catalogue";
import { after } from "next/server";
import { kickProductSync } from "@/lib/scoro/sync";

/**
 * Catalogue import wizard: a supplier PDF catalogue (photos, descriptions, specifications) plus
 * its price list (SKU, price) become draft products that are previewed and edited in the admin
 * before anything is written to the database.
 */

const DRAFT_TTL_MS = 2 * 60 * 60 * 1000;
const draftKey = (token: string) => `draft:${token}`;
const MAX_FETCH_BYTES = 300 * 1024 * 1024;

/** The supplier-list entry "Moooi CARPETS" matched a Moooi lamp list: show only the words the files name, at least the first. */
function shownBrand(listed: string, hay: string): string {
  const words = listed.split(/\s+/).filter(Boolean);
  if (words.length < 2) return listed;
  const h = hay.toLowerCase();
  const kept = words.filter((w, i) => i === 0 || h.includes(w.toLowerCase()));
  return kept.join(" ");
}

/** Image search: brand and product name ("Moooi Farooo floor lamp large, white"); the description only when the name is just a code. */
function photoQuery(brand: string, name: string, description = ""): string {
  const n = name.replace(/\s+[–-]\s+/g, " ").replace(/\s*\([^)]*\)\s*$/, "").trim();
  const words = n.split(/\s+/).filter((w) => /[a-z]{3}/i.test(w)).length;
  const extra = words < 2 ? description.split(/[,.\n]/)[0] : "";
  return [brand && !n.toLowerCase().startsWith(brand.toLowerCase()) ? brand : "", n, extra].filter(Boolean).join(" ").slice(0, 120);
}

const cents = (n: number | null | undefined) => (n == null ? "" : (n / 100).toFixed(2));

function fail(message: string): Draft {
  return { token: "", filename: "", createdAt: Date.now(), aiUsed: false, imageSearch: false, warnings: [], items: [], pool: [], error: message };
}

type PriceRow = Partial<Record<Field, string>>;

/** Reads the price list into rows keyed by SKU using the automatic column mapping. */
function readPriceList(buffer: ArrayBuffer, filename: string): { rows: Map<string, PriceRow>; order: string[]; warning?: string } {
  const parsed = parseSpreadsheet(buffer, filename);
  const mapping = guessMapping(parsed.headers);
  const skuCol = mapping.indexOf("sku");
  const rows = new Map<string, PriceRow>();
  const order: string[] = [];
  if (skuCol < 0) return { rows, order, warning: "Kainoraštyje nerastas SKU stulpelis – kainos nepriskirtos." };
  for (const r of parsed.rows) {
    const sku = (r[skuCol] ?? "").trim();
    if (!sku) continue;
    const row: PriceRow = {};
    mapping.forEach((f, i) => {
      if (f && (r[i] ?? "").trim()) row[f as Field] = r[i].trim();
    });
    rows.set(sku, row);
    order.push(sku);
  }
  return { rows, order };
}

async function fetchDocument(url: string): Promise<{ buffer: ArrayBuffer; name: string }> {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`Nepavyko atsisiųsti ${url} (${res.status}).`);
  const len = Number(res.headers.get("content-length") ?? 0);
  if (len > MAX_FETCH_BYTES) throw new Error(`${url}: failas per didelis (daugiau nei 300 MB).`);
  const buffer = await res.arrayBuffer();
  let name = decodeURIComponent(new URL(url).pathname.split("/").pop() || "document");
  if (!/\.[a-z0-9]{2,5}$/i.test(name)) {
    const type = (res.headers.get("content-type") ?? "").split(";")[0];
    const ext = { "application/pdf": ".pdf", "text/csv": ".csv", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx", "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" }[type];
    if (ext) name += ext;
  }
  return { buffer, name };
}

type Doc = { buffer: ArrayBuffer; name: string };

/** A price-list "image" cell may hold several URLs separated by spaces, new lines, commas, semicolons or pipes. */
function imageUrls(cell: string | undefined): string[] {
  return (cell ?? "")
    .split(/[\s,;|]+/)
    .map((u) => u.trim())
    .filter((u) => /^https?:\/\/\S+$/.test(u));
}

function textLines(text: string, page: number): PdfLine[] {
  return text
    .split(/\r?\n/)
    .map((t, i) => ({ text: t.replace(/\s+/g, " ").trim(), y: i, page, size: 1 }))
    .filter((l) => l.text);
}

/** Word paragraphs as lines; headings get a larger "size" so the section-heading rule applies. */
async function docxLines(buffer: ArrayBuffer, page: number): Promise<PdfLine[]> {
  const html = (await mammoth.convertToHtml({ buffer: Buffer.from(buffer) })).value;
  const out: PdfLine[] = [];
  const re = /<(h[1-6]|p|li|td|th)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const text = m[2].replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();
    if (text) out.push({ text, y: out.length, page, size: /^h/i.test(m[1]) ? 2 : 1 });
  }
  return out.length ? out : textLines((await mammoth.extractRawText({ buffer: Buffer.from(buffer) })).value, page);
}
const extOf = (name: string) => (name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "");

async function photoDataUrl(buffer: ArrayBuffer): Promise<string> {
  const buf = await sharp(Buffer.from(buffer)).flatten({ background: "#ffffff" }).resize({ width: 640, height: 640, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();
  return `data:image/jpeg;base64,${buf.toString("base64")}`;
}

/** Step 1: read every document, build the draft items and stage them. */
export async function analyzeCatalogue(_prev: Draft | null | undefined, formData: FormData): Promise<Draft | null> {
  await requireEditor();
  const brand = String(formData.get("brand") ?? "").trim();
  // "retail": catalogue prices already include VAT; "net": supplier price + transport % + VAT; "vat": + VAT only
  let priceMode = String(formData.get("priceMode") ?? "net");
  const warnings: string[] = [];

  try {
    const docs: Doc[] = [];
    for (const f of formData.getAll("documents")) {
      if (f instanceof File && f.size > 0) docs.push({ buffer: await f.arrayBuffer(), name: f.name });
    }
    const tempBlobs: string[] = [];
    for (const url of String(formData.get("urls") ?? "").split(/\s+/).filter((u) => /^https?:\/\//.test(u))) {
      docs.push(await fetchDocument(url));
      // files the browser uploaded straight to our Blob store are temporary
      if (/\.blob\.vercel-storage\.com$/.test(new URL(url).hostname) && /\/imports\//.test(url)) tempBlobs.push(url);
    }
    if (tempBlobs.length && process.env.BLOB_READ_WRITE_TOKEN) del(tempBlobs).catch(() => undefined);
    if (docs.length === 0) return fail("Įkelkite bent vieną dokumentą (PDF, Excel, CSV, Word, nuotraukas).");

    // --- read each document by type ---
    const lines: PdfLine[] = [];
    const images: PdfImage[] = [];
    const photos: { name: string; dataUrl: string }[] = [];
    const prices = { rows: new Map<string, PriceRow>(), order: [] as string[] };
    // a price-list PDF (article number … price per line) and the supplier list (brand, website, transport %)
    const priceList: { rows: PriceListRow[]; text: string; names: string[] } = { rows: [], text: "", names: [] };
    const blockRows = new Map<PriceListRow, BlockRow>(); // price-list rows that carry their own photos / dimensions
    const aiRows = new Set<PriceListRow>();
    const brandList: BrandInfo[] = [];
    // a presentation catalogue: one family per page with photos, materials, colours (no prices)
    const catalogue: { blocks: FamilyBlock[]; names: string[] } = { blocks: [], names: [] };
    let pageOffset = 0;
    let textPages = 0;
    let aiRead = false;
    const addPriceRows = (rows: BlockRow[], text: string, name: string, ai = false) => {
      for (const r of rows) {
        if (r.sku && priceList.rows.some((x) => x.sku === r.sku)) continue;
        priceList.rows.push(r);
        blockRows.set(r, r);
        if (ai) aiRows.add(r);
      }
      priceList.text += `\n${text}`;
      priceList.names.push(name);
    };
    for (const doc of docs) {
      const ext = extOf(doc.name);
      try {
        if (ext === "pdf") {
          const pl = await extractPriceListPdf(doc.buffer).catch((e: unknown) => {
            warnings.push(`${doc.name}: kainoraščio skaitymas nepavyko (${e instanceof Error ? e.message.split("\n")[0] : "klaida"}).`);
            return null;
          });
          if (pl && pl.rows.length > 0) warnings.push(`${doc.name}: ${pl.pages} psl., ${pl.rows.length} kainoraščio eilučių (kodas / aprašymas / kaina).`);
          if (pl && pl.rows.length >= 5) {
            priceList.rows.push(...pl.rows.filter((r) => !priceList.rows.some((x) => x.sku === r.sku)));
            priceList.text += `\n${pl.text}`;
            priceList.names.push(doc.name);
            continue;
          }
          // a price list printed as product blocks (title, specifications, finish / code / price table)
          const bl = await extractBlockPriceList(doc.buffer).catch(() => null);
          if (bl && bl.rows.length >= 5) {
            warnings.push(`${doc.name}: ${bl.pages} psl., ${bl.rows.length} pozicijų (${new Set(bl.rows.map((r) => r.family)).size} produktų${bl.index.length ? `, tipai pagal turinį` : ""}).`);
            for (const r of bl.rows) {
              if (priceList.rows.some((x) => x.sku === r.sku)) continue;
              priceList.rows.push(r);
              blockRows.set(r, r);
            }
            priceList.text += `\n${bl.text}`;
            priceList.names.push(doc.name);
            continue;
          }
          // a price list printed per family: title, designer, "Model:", article lines with code and € price, "complete" set price
          const sl = await extractSectionPriceList(doc.buffer).catch(() => null);
          if (sl && sl.rows.length >= 3) {
            warnings.push(`${doc.name}: ${sl.pages} psl., ${sl.rows.length} pozicijų su kodais ir kainomis (${sl.families} produktų šeimų).`);
            addPriceRows(sl.rows, sl.text, doc.name);
            continue;
          }
          // a table price list: header lines (family, type) above rows "variant · code · price"
          const tl = await extractTablePriceList(doc.buffer).catch(() => null);
          if (tl && tl.rows.length >= 5) {
            warnings.push(`${doc.name}: ${tl.pages} psl., ${tl.rows.length} pozicijų su kodais ir kainomis (${tl.families} produktų šeimų).`);
            if (tl.exclVat && priceMode === "retail") {
              // "Retail price € excl. of VAT": the website shows prices with VAT
              priceMode = "vat";
              warnings.push(`${doc.name}: kainoraštyje kainos „excl. VAT“ (be PVM) – svetainės kainai pridėtas PVM.`);
            }
            addPriceRows(tl.rows, tl.text, doc.name);
            continue;
          }
          // any other layout: AI reads it like a person would
          if (aiEnabled()) {
            const read = await readCatalogueWithAI(doc.buffer, brand).catch((e: unknown) => {
              warnings.push(`${doc.name}: AI skaitymas nepavyko (${e instanceof Error ? e.message.split("\n")[0] : "klaida"}).`);
              return null;
            });
            const priced = read ? read.rows.filter((r) => r.price > 0).length : 0;
            if (read && read.failed) warnings.push(`${doc.name}: AI neperskaitė ${read.failed} iš ${read.chunks} dalių (${read.error || "API klaida"}).`);
            if (read && read.rows.length) {
              warnings.push(
                `${doc.name}: AI perskaitė ${read.pages} psl. – ${read.rows.length} pozicijų, ${new Set(read.rows.map((r) => r.family)).size} produktų šeimų, ${priced} su kaina.` +
                  (read.currency && read.currency !== "EUR" ? ` Dėmesio: kainos ${read.currency}, ne EUR.` : "")
              );
            }
            // with prices it is a price list; a catalogue without prices goes on to the catalogue reader (photos for a separate price list)
            if (read && priced > 0 && priced >= read.rows.length / 2) {
              aiRead = true;
              addPriceRows(read.rows, "", doc.name, true);
              continue;
            }
          }
          const fam = await extractCatalogueFamilies(doc.buffer).catch((e: unknown) => {
            warnings.push(`${doc.name}: katalogo skaitymas nepavyko (${e instanceof Error ? e.message.split("\n")[0] : "klaida"}).`);
            return null;
          });
          if (fam && fam.blocks.length >= 3) {
            warnings.push(`${doc.name}: ${fam.pages} psl., ${fam.blocks.length} produktų šeimų su ${fam.blocks.reduce((n, b) => n + b.images.length, 0)} nuotraukomis.`);
            catalogue.blocks.push(...fam.blocks);
            catalogue.names.push(doc.name);
            continue;
          }
          const r = await extractPdfPages(doc.buffer);
          warnings.push(`${doc.name}: ${r.lines.length} teksto eilučių, ${r.images.length} nuotraukų.`);
          lines.push(...r.lines.map((l) => ({ ...l, page: l.page + pageOffset })));
          images.push(...r.images.map((im) => ({ ...im, page: im.page + pageOffset })));
          pageOffset += r.pages;
          textPages += r.pages;
          if (r.images.length === 0 && r.pages > 0) warnings.push(`${doc.name}: PDF be įterptų nuotraukų (gali būti skenuotas).`);
        } else if (["xlsx", "xls", "csv"].includes(ext) && looksLikeBrandList(doc.buffer, doc.name)) {
          brandList.push(...parseBrandList(doc.buffer, doc.name));
        } else if (["xlsx", "xls", "csv"].includes(ext)) {
          const r = readPriceList(doc.buffer, doc.name);
          if (r.warning) warnings.push(`${doc.name}: ${r.warning}`);
          for (const sku of r.order) {
            if (!prices.rows.has(sku)) prices.order.push(sku);
            prices.rows.set(sku, { ...(prices.rows.get(sku) ?? {}), ...r.rows.get(sku)! });
          }
        } else if (ext === "docx" || ext === "txt" || ext === "md") {
          pageOffset++;
          textPages++;
          lines.push(...(ext === "docx" ? await docxLines(doc.buffer, pageOffset) : textLines(new TextDecoder().decode(doc.buffer), pageOffset)));
        } else if (["jpg", "jpeg", "png", "webp", "gif"].includes(ext)) {
          photos.push({ name: doc.name, dataUrl: await photoDataUrl(doc.buffer) });
        } else if (ext === "doc") {
          warnings.push(`${doc.name}: senas .doc formatas nepalaikomas – išsaugokite kaip .docx arba PDF.`);
        } else {
          warnings.push(`${doc.name}: nepalaikomas failo tipas.`);
        }
      } catch (e) {
        warnings.push(`${doc.name}: ${e instanceof Error ? e.message.split("\n")[0] : "nepavyko perskaityti"}`);
      }
    }

    // --- text documents → product blocks anchored on SKUs ---
    let pdfProducts: PdfProduct[] = splitProducts(lines, images, prices.order);
    const hasPrices = prices.order.length > 0;
    if (textPages > 0 && pdfProducts.length === 0) {
      warnings.push(
        hasPrices
          ? "Dokumentų tekste nerasta nė vieno kainoraščio SKU – patikrinkite, ar kodai sutampa."
          : "Dokumentuose nerasta produktų kodų („Art. no.“, „SKU“, „Kodas“…)." + (aiEnabled() ? " Produktus išskyrė AI." : " Įkelkite kainoraštį su SKU stulpeliu arba įjunkite AI (ANTHROPIC_API_KEY).")
      );
    }

    // --- optional AI pass: structure each block, or extract products from free text ---
    let aiUsed = aiRead;
    let aiFree: AiProductFields[] = [];
    if (pdfProducts.length === 0 && lines.length > 0 && aiEnabled()) {
      aiFree = await extractProductsFromText(lines.map((l) => l.text).join("\n"), brand).catch((e: unknown) => {
        warnings.push(`AI analizė nepavyko: ${e instanceof Error ? e.message.split("\n")[0] : "klaida"}`);
        return [];
      });
      if (aiFree.length) {
        aiUsed = true;
        // images follow document order when nothing anchors them
        pdfProducts = aiFree.map((a, n) => ({ sku: a.sku || "", page: 0, header: [a.name], heading: a.category, body: [], images: images[n] ? [images[n]] : [] }));
      }
    }
    const ai = await structureProducts(
      pdfProducts.map((p) => ({ sku: p.sku, heading: p.heading, text: [...p.header, ...p.body].join("\n") })),
      brand
    ).catch((e: unknown) => {
      warnings.push(`AI analizė nepavyko: ${e instanceof Error ? e.message.split("\n")[0] : "klaida"}`);
      return new Map();
    });
    if (ai.size > 0) aiUsed = true;

    // --- merge into draft items (price list is the source of truth for price / SKU) ---
    const items: DraftItem[] = [];
    const bySku = new Map<string, DraftItem>();
    for (const [n, p] of pdfProducts.entries()) {
      const f = parseFields(p);
      const a = ai.get(p.sku) ?? aiFree[n];
      const row = prices.rows.get(p.sku) ?? {};
      // the website has fixed categories (Furniture / Lighting / Decor) and typologies (Sofas, Dining tables…):
      // supplier sections and types are mapped onto them so the product appears under the menu links
      const section = row.category || a?.category || p.heading;
      const type = row.typology || a?.typology || f.typology;
      const taxonomy = classify({ section, type, name: row.name || a?.name || f.name, description: a?.description || row.description });
      const item: DraftItem = {
        idx: items.length,
        sku: p.sku,
        name: row.name || a?.name || f.name,
        description: a?.description || row.description || f.description,
        category: SITE_CATEGORY_RE.test(section) ? section : taxonomy.category,
        brand: row.brand || brand,
        typology: taxonomy.typology || type,
        material: row.material || a?.material || f.material,
        colour: row.colour || a?.colour || f.colour,
        dimensions: a?.dimensions || f.dimensions,
        weight: a?.weight || f.weight,
        price: row.price ? cents(parsePriceCents(row.price)) : a?.price ? cents(parsePriceCents(a.price)) : cents(f.priceCents),
        salePrice: row.sale_price ? cents(parsePriceCents(row.sale_price)) : "",
        from: [...(aiFree.length ? ["ai" as const] : ["pdf" as const]), ...(prices.rows.has(p.sku) ? ["pricelist" as const] : [])],
        page: p.page || null,
        existing: null,
        images: [
          ...p.images.map((im, n) => ({ kind: "catalogue" as const, src: im.dataUrl, selected: n === 0 })),
          ...imageUrls(row.image_url).map((src) => ({ kind: "web" as const, src, source: new URL(src).hostname.replace(/^www\./, ""), selected: p.images.length === 0 })),
        ],
      };
      items.push(item);
      if (p.sku) bySku.set(p.sku, item);
    }
    // price-list rows that were not found in the documents
    if (hasPrices) {
      for (const sku of prices.order) {
        if (bySku.has(sku)) continue;
        const row = prices.rows.get(sku)!;
        if (!row.name && !row.description) continue;
        const taxonomy = classify({ section: row.category, type: row.typology, name: row.name, description: row.description });
        const item: DraftItem = {
          idx: items.length,
          sku,
          name: row.name || sku,
          description: row.description || "",
          category: row.category && SITE_CATEGORY_RE.test(row.category) ? row.category : taxonomy.category,
          brand: row.brand || brand,
          typology: taxonomy.typology || row.typology || "",
          material: row.material || "",
          colour: row.colour || "",
          dimensions: "",
          weight: "",
          price: cents(parsePriceCents(row.price ?? "")),
          salePrice: row.sale_price ? cents(parsePriceCents(row.sale_price)) : "",
          from: ["pricelist"],
          page: null,
          existing: null,
          images: imageUrls(row.image_url).map((src) => ({ kind: "web" as const, src, source: new URL(src).hostname.replace(/^www\./, ""), selected: true })),
        };
        items.push(item);
        bySku.set(sku, item);
      }
      const missing = prices.order.filter((s) => !pdfProducts.some((p) => p.sku === s)).length;
      if (textPages > 0 && missing > 0) warnings.push(`${missing} kainoraščio pozicijų nerasta kataloge – jos įtrauktos be nuotraukų.`);
    }
    // --- price-list PDF → products; prices with the brand's transport % and VAT ---
    // Photos and specifications come from the presentation catalogue (same family) and the brand's website.
    const specLines = (b: FamilyBlock) =>
      [b.materials && `Materials: ${b.materials}`, b.colours && `Colours: ${b.colours}`, b.lightSource && `Light source: ${b.lightSource}`, b.notes].filter(Boolean).join("\n");
    const photoTargets: { family: string; typeHint: string; items: DraftItem[] }[] = [];
    let info: BrandInfo | null = null;
    let brandName = brand;
    if (priceList.rows.length > 0 || catalogue.blocks.length > 0) {
      info = matchBrand(brandList, { brand, text: `${priceList.text} ${catalogue.blocks.map((b) => b.family).join(" ")}`, filename: [...priceList.names, ...catalogue.names].join(" ") });
      brandName = brand || shownBrand(info?.brand ?? "", `${[...priceList.names, ...catalogue.names].join(" ")} ${catalogue.blocks.map((b) => b.family).join(" ")}`);
      if (!brandName) warnings.push("Prekės ženklas nenustatytas – įrašykite jį laukelyje „Prekės ženklas“ ir analizuokite iš naujo.");
    }
    if (priceList.rows.length > 0) {
      const vat = priceMode === "retail" ? 0 : Number.parseFloat(process.env.IMPORT_VAT_PERCENT ?? "21") || 0;
      const pct = priceMode === "net" ? info?.transportPct ?? 0 : 0;
      const products = priceList.rows.map((r) => productFromPriceRow(r, brandName));
      disambiguateNames(products);
      let withCatalogue = 0;
      for (const [n, p] of products.entries()) {
        if (p.sku && bySku.has(p.sku)) continue;
        const row = priceList.rows[n];
        const fam = catalogue.blocks.length ? findFamily(catalogue.blocks, p.family, p.typeHint) : null;
        if (fam) withCatalogue++;
        const own = blockRows.get(row);
        const item: DraftItem = {
          idx: items.length,
          sku: p.sku,
          name: p.name,
          description: fam ? `${p.description}\n${specLines(fam)}` : p.description,
          category: p.category,
          brand: brandName,
          typology: p.typology,
          material: fam?.materials ?? own?.materials ?? "",
          colour: p.colour,
          dimensions: p.dimensions || own?.dimensions || fam?.dimensions || "",
          weight: "",
          price: p.netPrice > 0 ? (Math.round(p.netPrice * (1 + pct / 100) * (1 + vat / 100) * 100) / 100).toFixed(2) : "",
          salePrice: "",
          from: [...(aiRows.has(row) ? (["ai"] as const) : []), ...(fam ? (["pricelist", "pdf"] as const) : (["pricelist"] as const))],
          page: fam?.page ?? null,
          existing: null,
          images: [...(own?.images ?? []), ...(fam?.images ?? [])].map((src, i) => ({ kind: "catalogue" as const, src, selected: i < 2 })),
        };
        items.push(item);
        if (p.sku) bySku.set(p.sku, item);
        const key = photoTargets.find((t) => t.family === p.family && t.typeHint === p.typeHint);
        if (key) key.items.push(item);
        else photoTargets.push({ family: p.family, typeHint: p.typeHint, items: [item] });
      }
      warnings.push(
        priceMode === "retail"
          ? `Kainoraštis (${priceList.names.join(", ")}): ${products.length} pozicijų. Kaina svetainėje = kaina kaip kataloge (mažmeninė, su PVM).`
          : `Kainoraštis (${priceList.names.join(", ")}): ${products.length} pozicijų. Kaina svetainėje = katalogo kaina${pct ? ` + ${pct}% transportas` : ""} + ${vat}% PVM` +
            (priceMode === "vat" ? "." : info ? ` (${info.brand}, pagal tiekėjų sąrašą).` : brandList.length ? ". Prekės ženklas tiekėjų sąraše nerastas – transporto % nepritaikytas; įrašykite prekės ženklą laukelyje." : ". Tiekėjų sąrašas (List.xlsx) neįkeltas – transporto % nepritaikytas.")
      );
      if (catalogue.blocks.length) warnings.push(`Katalogas (${catalogue.names.join(", ")}): nuotraukos ir aprašymai priskirti ${withCatalogue} iš ${products.length} pozicijų pagal produkto šeimą.`);
    } else if (catalogue.blocks.length > 0) {
      // no price list: one product per catalogue family, without code and price
      for (const b of catalogue.blocks) {
        const taxonomy = classify({ type: b.type, name: b.family, section: b.section });
        const name = `${b.family} ${b.type.charAt(0).toLowerCase()}${b.type.slice(1)}`.trim();
        const item: DraftItem = {
          idx: items.length,
          sku: "",
          name,
          description: `${b.family}${brandName ? ` by ${brandName}` : ""} – ${b.type}.\n\n${specLines(b)}`.trim(),
          category: taxonomy.category,
          brand: brandName,
          typology: taxonomy.typology,
          material: b.materials,
          colour: b.colours,
          dimensions: b.dimensions,
          weight: "",
          price: "",
          salePrice: "",
          from: ["pdf"],
          page: b.page,
          existing: null,
          images: b.images.map((src, i) => ({ kind: "catalogue" as const, src, selected: i < 2 })),
        };
        items.push(item);
        photoTargets.push({ family: b.family, typeHint: b.type, items: [item] });
      }
      warnings.push(
        `Katalogas (${catalogue.names.join(", ")}): ${catalogue.blocks.length} produktų šeimų be kodų ir kainų. Įkelkite kartu ir kainoraštį (PDF arba Excel su kodais ir kainomis), kad kiekviena spalva ir dydis taptų atskira pozicija su kaina.`
      );
    }
    if (photoTargets.length && info?.website) {
      const host = new URL(info.website).hostname.replace(/^www\./, "");
      try {
        const urls = await siteUrls(info.website);
        const pages = photoTargets.map((t) => (urls.length ? matchProductPage(t.family, t.typeHint, urls) : null));
        const uniquePages = [...new Set(pages.filter((u): u is string => Boolean(u)))];
        const fetched = await mapConcurrent(uniquePages, 8, (u) => pageImages(u, 4));
        const imagesOf = new Map(uniquePages.map((u, i) => [u, fetched[i] ?? []]));
        let withPhotos = 0;
        for (const [n, t] of photoTargets.entries()) {
          const page = pages[n];
          const imgs = page ? imagesOf.get(page) ?? [] : [];
          if (!imgs.length) continue;
          withPhotos++;
          for (const it of t.items) {
            let selected = it.images.filter((im) => im.selected).length;
            it.images.push(...imgs.map((src) => ({ kind: "web" as const, src, source: host, selected: selected++ < 3 })));
          }
        }
        warnings.push(
          urls.length
            ? `Nuotraukos iš ${host}: rasta ${withPhotos} iš ${photoTargets.length} produktų grupių${withPhotos < photoTargets.length ? "; likusioms ieškoma internete arba pridėkite rankiniu būdu" : ""}.`
            : `${host}: svetainės žemėlapis (sitemap) nerastas – nuotraukų iš tiekėjo svetainės paimti nepavyko.`
        );
      } catch (e) {
        warnings.push(`${host}: nuotraukų paimti nepavyko (${e instanceof Error ? e.message.split("\n")[0] : "klaida"}).`);
      }
    }
    if (items.length === 0) return fail(`Nepavyko sudaryti nė vieno produkto. ${warnings.join(" ")}`.trim());

    // --- loose photos: matched to products by file name (SKU or product name) ---
    const pool: { name: string; src: string }[] = [];
    for (const ph of photos) {
      const keys = imageKeyCandidates(ph.name).map((k) => k.toLowerCase());
      const target = items.find((it) => keys.includes(it.sku.toLowerCase()) || keys.map(slugify).includes(slugify(it.name)));
      // a photo deliberately named after the product is wanted: select it
      if (target) target.images.push({ kind: "catalogue", src: ph.dataUrl, selected: true });
      else pool.push({ name: ph.name, src: ph.dataUrl });
    }
    // document images that no product block claimed (photo-only PDF, image catalogue)
    const claimed = new Set(pdfProducts.flatMap((p) => p.images.map((im) => im.dataUrl)));
    for (const [n, im] of images.filter((im) => !claimed.has(im.dataUrl)).entries()) pool.push({ name: `dokumentas, psl. ${im.page} #${n + 1}`, src: im.dataUrl });

    if (pool.length > 0) {
      const withoutPhoto = items.filter((it) => it.images.length === 0);
      let assigned = 0;
      if (withoutPhoto.length > 0 && aiEnabled()) {
        // AI looks at each photo and names the product it shows
        const map = await matchPhotosToProducts(pool.map((p) => p.src), withoutPhoto.map((it) => ({ key: it.idx, label: [it.brand, it.name, it.description].filter(Boolean).join(" – ") }))).catch(() => new Map<number, number>());
        for (const [photoIdx, itemIdx] of map) {
          const it = items[itemIdx];
          if (!it || !pool[photoIdx]) continue;
          it.images.push({ kind: "catalogue", src: pool[photoIdx].src, selected: it.images.length === 0 });
          assigned++;
        }
        if (assigned) warnings.push(`AI priskyrė ${assigned} nuotraukas produktams pagal vaizdą – patikrinkite peržiūroje.`);
      } else if (withoutPhoto.length > 0 && pool.length === withoutPhoto.length) {
        // same count: assume the photos follow the product order
        withoutPhoto.forEach((it, n) => it.images.push({ kind: "catalogue", src: pool[n].src, selected: true }));
        assigned = pool.length;
        warnings.push(`${assigned} nuotraukos priskirtos produktams pagal eiliškumą – patikrinkite peržiūroje.`);
      }
      if (assigned < pool.length) {
        warnings.push(`${pool.length - assigned} nuotraukų liko nepriskirtos: pridėkite jas produktams peržiūroje mygtuku „Iš dokumentų“ (arba pavadinkite failus pagal SKU).`);
      }
    }

    // --- products still without a photo: look for one on the web ---
    const autoSearch = formData.get("webPhotos") !== "off";
    const noPhoto = items.filter((it) => it.images.length === 0);
    if (noPhoto.length > 0) {
      if (!imageSearchEnabled()) {
        warnings.push(`${noPhoto.length} produktai be nuotraukų. Automatinė paieška internete neįjungta – nustatykite SERPER_API_KEY (žr. .env.example).`);
      } else if (autoSearch) {
        const LIMIT = 80; // Google's free tier is 100 queries a day
        const batch = noPhoto.slice(0, LIMIT);
        let found = 0;
        const failures: string[] = [];
        const worker = async (it: DraftItem) => {
          const q = photoQuery(it.brand, it.name);
          try {
            const results = await searchImages(q, 6);
            if (results.length === 0) return;
            let matching: number[] | null = null;
            if (aiEnabled()) matching = await rankImageCandidates(results[0].thumb || results[0].src, results, q).catch(() => null);
            const keep = matching && matching.length ? matching.slice(0, 3) : [0];
            it.images.push(...results.map((c, i) => ({ kind: "web" as const, src: c.src, thumb: c.thumb, source: c.source, selected: keep.includes(i) })));
            found++;
          } catch (e) {
            failures.push(e instanceof Error ? e.message : "paieška nepavyko");
          }
        };
        // a few searches at a time
        for (let i = 0; i < batch.length; i += 4) await Promise.all(batch.slice(i, i + 4).map(worker));
        warnings.push(`Internete rasta nuotraukų ${found} iš ${batch.length} produktų be nuotraukų${aiEnabled() ? " (AI pažymėjo tinkamiausias)" : " (pažymėta pirma rasta – patikrinkite)"}.`);
        if (failures.length) warnings.push(`Paieška nepavyko ${failures.length} produktams: ${failures[0]}`);
        if (noPhoto.length > LIMIT) warnings.push(`Paieška atlikta tik pirmiems ${LIMIT} produktams be nuotraukų; likusiems spauskite „Rasti daugiau nuotraukų“.`);
      }
    }

    // --- already in the catalogue? ---
    const existing = await db.product.findMany({ where: { sku: { in: items.map((i) => i.sku).filter(Boolean) } }, select: { id: true, sku: true, name: true } });
    for (const e of existing) {
      const it = e.sku ? bySku.get(e.sku) : undefined;
      if (it) it.existing = { id: e.id, name: e.name };
    }

    const token = randomBytes(8).toString("hex");
    const draft: Draft = {
      token,
      filename: docs.map((d) => d.name).join(", "),
      createdAt: Date.now(),
      aiUsed,
      imageSearch: imageSearchEnabled(),
      warnings,
      items,
      pool: pool.map((p) => ({ name: p.name, src: p.src })),
    };
    await db.setting.upsert({ where: { key: draftKey(token) }, create: { key: draftKey(token), value: JSON.stringify(draft) }, update: { value: JSON.stringify(draft) } });
    // housekeeping: drop stale drafts
    for (const s of await db.setting.findMany({ where: { key: { startsWith: "draft:" } }, select: { key: true, value: true } })) {
      try {
        if (Date.now() - (JSON.parse(s.value) as Draft).createdAt > DRAFT_TTL_MS) await db.setting.delete({ where: { key: s.key } });
      } catch {
        await db.setting.delete({ where: { key: s.key } });
      }
    }
    return draft;
  } catch (e) {
    return fail(`${e instanceof Error ? e.message.split("\n").filter(Boolean)[0] : "Nepavyko apdoroti failų."} ${warnings.join(" ")}`.trim());
  }
}

async function loadDraft(token: string): Promise<Draft | null> {
  const row = await db.setting.findUnique({ where: { key: draftKey(token) } });
  return row ? (JSON.parse(row.value) as Draft) : null;
}

export type FoundImages = { candidates: (ImageCandidate & { match: boolean })[]; error?: string };

/** Finds more photos of a draft product online; with AI configured, flags the ones showing the same product. */
export async function findMoreImages(token: string, idx: number, override?: { brand?: string; name?: string; description?: string }): Promise<FoundImages> {
  await requireEditor();
  const draft = await loadDraft(token);
  const item = draft?.items[idx];
  if (!item) return { candidates: [], error: "Juodraščio nebėra – įkelkite failus iš naujo." };
  const brand = override?.brand ?? item.brand;
  const name = override?.name ?? item.name;
  const description = override?.description ?? item.description;
  const query = photoQuery(brand, name, description);
  try {
    const found = await searchImages(query, 10);
    const reference = item.images.find((im) => im.kind === "catalogue")?.src;
    let matching: number[] | null = null;
    if (reference && aiEnabled()) {
      matching = await rankImageCandidates(reference, found, `${brand} ${name}`.trim()).catch(() => null);
    }
    const ordered = matching ? [...matching.map((i) => found[i]), ...found.filter((_, i) => !matching!.includes(i))] : found;
    return { candidates: ordered.map((c) => ({ ...c, match: matching ? matching.includes(found.indexOf(c)) : false })) };
  } catch (e) {
    return { candidates: [], error: e instanceof Error ? e.message : "Paieška nepavyko." };
  }
}

async function fetchImageAsFile(url: string, name: string): Promise<File> {
  const res = await fetch(url, { redirect: "follow", headers: { "user-agent": "Mozilla/5.0 (compatible; SimetriaImport/1.0)" } });
  if (!res.ok) throw new Error(`nuotraukos atsisiųsti nepavyko (${res.status})`);
  const type = (res.headers.get("content-type") ?? "").split(";")[0].trim() || "image/jpeg";
  const buf = Buffer.from(await res.arrayBuffer());
  return new File([buf], name, { type });
}

/** Product photos are stored at most 1600 px on the long side as JPEG: far smaller uploads and faster pages. */
async function optimizeImage(file: File): Promise<File> {
  try {
    const buf = await sharp(Buffer.from(await file.arrayBuffer()))
      .rotate()
      .flatten({ background: "#ffffff" })
      .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 85, mozjpeg: true })
      .toBuffer();
    return new File([buf], file.name.replace(/\.[a-z0-9]+$/i, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file; // not an image sharp understands: upload as is
  }
}

function dataUrlToFile(dataUrl: string, name: string): File {
  const m = dataUrl.match(/^data:(image\/[a-z]+);base64,(.+)$/);
  if (!m) throw new Error("netinkamas nuotraukos formatas");
  return new File([Buffer.from(m[2], "base64")], name, { type: m[1] });
}

/** Step 2: write the reviewed items to the catalogue. */
export async function publishDraft(_prev: PublishResult | null | undefined, formData: FormData): Promise<PublishResult | null> {
  await requireEditor();
  const token = String(formData.get("token") ?? "");
  const publish = formData.get("publish") === "on";
  const draft = await loadDraft(token);
  if (!draft) return { created: 0, updated: 0, errors: [], products: [], error: "Juodraščio nebėra (praėjo daugiau nei 2 val.). Įkelkite failus iš naujo." };
  let items: SubmitItem[];
  try {
    items = JSON.parse(String(formData.get("items") ?? "[]")) as SubmitItem[];
  } catch {
    return { created: 0, updated: 0, errors: [], products: [], error: "Netinkami duomenys." };
  }

  const result: PublishResult = { created: 0, updated: 0, errors: [], products: [] };
  const categoryCache = new Map<string, string>();
  const categoryId = async (name: string) => {
    const slug = siteCategorySlug(name) || slugify(name);
    if (!slug) return null;
    if (!categoryCache.has(slug)) {
      const cat = await db.category.upsert({ where: { slug }, create: { name, slug }, update: {} });
      categoryCache.set(slug, cat.id);
    }
    return categoryCache.get(slug)!;
  };

  for (const it of items) {
    if (!it.include) continue;
    const name = it.name.trim();
    const sku = it.sku.trim() || null;
    if (!name) {
      result.errors.push(`#${it.idx + 1}: trūksta pavadinimo`);
      continue;
    }
    try {
      const data = {
        name,
        sku,
        description: composeDescription(it),
        priceCents: parsePriceCents(it.price) ?? 0,
        salePriceCents: it.salePrice.trim() ? parsePriceCents(it.salePrice) : null,
        brand: it.brand.trim() || null,
        typology: it.typology.trim() || null,
        material: it.material.trim() || null,
        categoryId: it.category.trim() ? await categoryId(it.category.trim()) : null,
        published: publish,
      };
      // variant group: same design in another colour / finish / colour temperature shares a card
      const derived = deriveVariant({ name, brand: data.brand, typology: data.typology, colour: it.colour, description: data.description, sku });
      Object.assign(data, { groupKey: derived.groupKey, variantAttrs: derived.attrs, variantLabel: derived.label || null });
      const existing = sku ? await db.product.findUnique({ where: { sku } }) : null;
      let product;
      if (existing) {
        product = await db.product.update({ where: { id: existing.id }, data });
        result.updated++;
      } else {
        let slug = slugify(name);
        if (await db.product.findUnique({ where: { slug } })) slug = slugify(`${name}-${sku ?? it.idx}`);
        product = await db.product.create({ data: { ...data, slug } });
        result.created++;
      }
      result.products.push({ id: product.id, slug: product.slug, name: product.name });

      // images: replace the product's photos with the selected ones (fetched in parallel, resized before upload)
      const stored = draft.items[it.idx];
      const base = sku ?? slugify(name);
      const fetched = await Promise.all(
        it.images.map(async (ref, n): Promise<File | null> => {
          try {
            if (ref.kind === "catalogue") {
              const src = stored?.images[ref.index]?.src;
              return src ? dataUrlToFile(src, `${base}-${n + 1}.jpg`) : null;
            }
            if (ref.kind === "pool") {
              const src = draft.pool[ref.index]?.src;
              return src ? dataUrlToFile(src, `${base}-${n + 1}.jpg`) : null;
            }
            return /^https?:\/\//.test(ref.src) ? await fetchImageAsFile(ref.src, `${base}-${n + 1}.jpg`) : null;
          } catch (e) {
            result.errors.push(`${name}: ${e instanceof Error ? e.message : "nuotraukos klaida"}`);
            return null;
          }
        })
      );
      const files = fetched.filter((f): f is File => f !== null);
      if (files.length > 0) {
        const uploaded = await Promise.all(
          files.map(async (file) => {
            try {
              return await saveImage(await optimizeImage(file));
            } catch (e) {
              result.errors.push(`${name}: ${e instanceof Error ? e.message : "nuotraukos klaida"}`);
              return null;
            }
          })
        );
        const urls = uploaded.filter((u): u is string => Boolean(u));
        if (urls.length > 0) {
          await db.productImage.deleteMany({ where: { productId: product.id } });
          await db.productImage.createMany({ data: urls.map((url, n) => ({ productId: product.id, url, alt: name, sort: n })) });
        }
      }
    } catch (e) {
      result.errors.push(`${name}: ${e instanceof Error ? e.message.split("\n").filter(Boolean)[0] : "klaida"}`);
    }
  }

  if (formData.get("final") !== "off") await db.setting.delete({ where: { key: draftKey(token) } }).catch(() => undefined);
  revalidatePath("/catalogue");
  revalidatePath("/outlet");
  revalidatePath("/admin/products");
  await kickProductSync(after);
  return result;
}
