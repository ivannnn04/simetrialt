"use server";

import { revalidatePath } from "next/cache";
import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { slugify } from "@/lib/slug";
import { saveImage } from "@/lib/uploads";
import { guessMapping, parsePriceCents, parseSpreadsheet, type Field } from "@/lib/catalogue-import";
import { extractPdfPages, parseFields, splitProducts, type PdfProduct } from "@/lib/catalogue-pdf";
import { aiEnabled, rankImageCandidates, structureProducts, type ImageCandidate } from "@/lib/ai";
import { imageSearchEnabled, searchImages } from "@/lib/image-search";
import { composeDescription, type Draft, type DraftItem, type PublishResult, type SubmitItem } from "@/lib/catalogue-wizard";

/**
 * Catalogue import wizard: a supplier PDF catalogue (photos, descriptions, specifications) plus
 * its price list (SKU, price) become draft products that are previewed and edited in the admin
 * before anything is written to the database.
 */

const DRAFT_TTL_MS = 2 * 60 * 60 * 1000;
const draftKey = (token: string) => `draft:${token}`;
const MAX_FETCH_BYTES = 40 * 1024 * 1024;

const cents = (n: number | null | undefined) => (n == null ? "" : (n / 100).toFixed(2));

function fail(message: string): Draft {
  return { token: "", filename: "", createdAt: Date.now(), aiUsed: false, imageSearch: false, warnings: [], items: [], error: message };
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

async function fetchPdf(url: string): Promise<{ buffer: ArrayBuffer; name: string }> {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`Nepavyko atsisiųsti PDF (${res.status}).`);
  const len = Number(res.headers.get("content-length") ?? 0);
  if (len > MAX_FETCH_BYTES) throw new Error("PDF per didelis (daugiau nei 40 MB).");
  const buffer = await res.arrayBuffer();
  const name = decodeURIComponent(new URL(url).pathname.split("/").pop() || "catalogue.pdf");
  return { buffer, name };
}

/** Step 1: read the files, build the draft items and stage them. */
export async function analyzeCatalogue(_prev: Draft | null | undefined, formData: FormData): Promise<Draft | null> {
  await requireUser();
  const brand = String(formData.get("brand") ?? "").trim();
  const pdfFile = formData.get("catalogue");
  const pdfUrl = String(formData.get("catalogueUrl") ?? "").trim();
  const priceFile = formData.get("pricelist");
  const warnings: string[] = [];

  try {
    let pdf: { buffer: ArrayBuffer; name: string } | null = null;
    if (pdfFile instanceof File && pdfFile.size > 0) pdf = { buffer: await pdfFile.arrayBuffer(), name: pdfFile.name };
    else if (/^https?:\/\//.test(pdfUrl)) pdf = await fetchPdf(pdfUrl);

    let prices: ReturnType<typeof readPriceList> | null = null;
    if (priceFile instanceof File && priceFile.size > 0) {
      prices = readPriceList(await priceFile.arrayBuffer(), priceFile.name);
      if (prices.warning) warnings.push(prices.warning);
    }
    if (!pdf && !prices) return fail("Įkelkite PDF katalogą ir/arba kainoraštį.");

    // --- PDF → product blocks ---
    let pdfProducts: PdfProduct[] = [];
    if (pdf) {
      const { lines, images, pages } = await extractPdfPages(pdf.buffer);
      pdfProducts = splitProducts(lines, images, prices ? prices.order : []);
      if (pdfProducts.length === 0) {
        warnings.push(
          prices
            ? `PDF (${pages} psl.) tekste nerasta nė vieno kainoraščio SKU – patikrinkite, ar kodai sutampa.`
            : `PDF (${pages} psl.) nerasta produktų kodų („Art. no.“, „SKU“, „Kodas“…). Įkelkite kainoraštį su SKU stulpeliu.`
        );
      }
      if (images.length === 0 && pages > 0) warnings.push("PDF neturi įterptų nuotraukų (gali būti skenuotas) – nuotraukas reikės rasti internete.");
    }

    // --- optional AI pass over the PDF text ---
    let aiUsed = false;
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
    for (const p of pdfProducts) {
      const f = parseFields(p);
      const a = ai.get(p.sku);
      const row = prices?.rows.get(p.sku) ?? {};
      const item: DraftItem = {
        idx: items.length,
        sku: p.sku,
        name: row.name || a?.name || f.name,
        description: a?.description || row.description || f.description,
        category: row.category || a?.category || p.heading,
        brand: row.brand || brand,
        typology: row.typology || a?.typology || f.typology,
        material: row.material || a?.material || f.material,
        colour: row.colour || a?.colour || f.colour,
        dimensions: a?.dimensions || f.dimensions,
        weight: a?.weight || f.weight,
        price: row.price ? cents(parsePriceCents(row.price)) : cents(f.priceCents),
        salePrice: row.sale_price ? cents(parsePriceCents(row.sale_price)) : "",
        from: prices?.rows.has(p.sku) ? ["pdf", "pricelist"] : ["pdf"],
        page: p.page,
        existing: null,
        images: p.images.map((im, n) => ({ kind: "catalogue", src: im.dataUrl, selected: n === 0 })),
      };
      items.push(item);
      bySku.set(p.sku, item);
    }
    // price-list rows that were not found in the PDF
    if (prices) {
      for (const sku of prices.order) {
        if (bySku.has(sku)) continue;
        const row = prices.rows.get(sku)!;
        if (!row.name && !row.description) continue;
        const item: DraftItem = {
          idx: items.length,
          sku,
          name: row.name || sku,
          description: row.description || "",
          category: row.category || "",
          brand: row.brand || brand,
          typology: row.typology || "",
          material: row.material || "",
          colour: row.colour || "",
          dimensions: "",
          weight: "",
          price: cents(parsePriceCents(row.price ?? "")),
          salePrice: row.sale_price ? cents(parsePriceCents(row.sale_price)) : "",
          from: ["pricelist"],
          page: null,
          existing: null,
          images: row.image_url && /^https?:\/\//.test(row.image_url) ? [{ kind: "web", src: row.image_url, selected: true }] : [],
        };
        items.push(item);
        bySku.set(sku, item);
      }
      const missing = prices.order.filter((s) => !pdfProducts.some((p) => p.sku === s)).length;
      if (pdf && missing > 0) warnings.push(`${missing} kainoraščio pozicijų nerasta PDF kataloge – jos įtrauktos be nuotraukų.`);
    }
    if (items.length === 0) return fail("Nepavyko sudaryti nė vieno produkto. Patikrinkite failus.");

    // --- already in the catalogue? ---
    const existing = await db.product.findMany({ where: { sku: { in: items.map((i) => i.sku) } }, select: { id: true, sku: true, name: true } });
    for (const e of existing) {
      const it = e.sku ? bySku.get(e.sku) : undefined;
      if (it) it.existing = { id: e.id, name: e.name };
    }

    const token = randomBytes(8).toString("hex");
    const draft: Draft = {
      token,
      filename: pdf?.name ?? (priceFile instanceof File ? priceFile.name : ""),
      createdAt: Date.now(),
      aiUsed,
      imageSearch: imageSearchEnabled(),
      warnings,
      items,
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
    return fail(e instanceof Error ? e.message.split("\n").filter(Boolean)[0] : "Nepavyko apdoroti failų.");
  }
}

async function loadDraft(token: string): Promise<Draft | null> {
  const row = await db.setting.findUnique({ where: { key: draftKey(token) } });
  return row ? (JSON.parse(row.value) as Draft) : null;
}

export type FoundImages = { candidates: (ImageCandidate & { match: boolean })[]; error?: string };

/** Finds more photos of a draft product online; with AI configured, flags the ones showing the same product. */
export async function findMoreImages(token: string, idx: number, override?: { brand?: string; name?: string; description?: string }): Promise<FoundImages> {
  await requireUser();
  const draft = await loadDraft(token);
  const item = draft?.items[idx];
  if (!item) return { candidates: [], error: "Juodraščio nebėra – įkelkite failus iš naujo." };
  const brand = override?.brand ?? item.brand;
  const name = override?.name ?? item.name;
  const description = override?.description ?? item.description;
  const query = [brand, name, description.split(/[,.\n]/)[0]].filter(Boolean).join(" ").slice(0, 120);
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

function dataUrlToFile(dataUrl: string, name: string): File {
  const m = dataUrl.match(/^data:(image\/[a-z]+);base64,(.+)$/);
  if (!m) throw new Error("netinkamas nuotraukos formatas");
  return new File([Buffer.from(m[2], "base64")], name, { type: m[1] });
}

/** Step 2: write the reviewed items to the catalogue. */
export async function publishDraft(_prev: PublishResult | null | undefined, formData: FormData): Promise<PublishResult | null> {
  await requireUser();
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
    const slug = slugify(name);
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

      // images: replace the product's photos with the selected ones
      const files: File[] = [];
      const stored = draft.items[it.idx];
      for (const [n, ref] of it.images.entries()) {
        try {
          if (ref.kind === "catalogue") {
            const src = stored?.images[ref.index]?.src;
            if (src) files.push(dataUrlToFile(src, `${sku ?? slugify(name)}-${n + 1}.jpg`));
          } else if (/^https?:\/\//.test(ref.src)) {
            files.push(await fetchImageAsFile(ref.src, `${sku ?? slugify(name)}-${n + 1}.jpg`));
          }
        } catch (e) {
          result.errors.push(`${name}: ${e instanceof Error ? e.message : "nuotraukos klaida"}`);
        }
      }
      if (files.length > 0) {
        await db.productImage.deleteMany({ where: { productId: product.id } });
        for (const [n, file] of files.entries()) {
          try {
            const url = await saveImage(file);
            await db.productImage.create({ data: { productId: product.id, url, alt: name, sort: n } });
          } catch (e) {
            result.errors.push(`${name}: ${e instanceof Error ? e.message : "nuotraukos klaida"}`);
          }
        }
      }
    } catch (e) {
      result.errors.push(`${name}: ${e instanceof Error ? e.message.split("\n").filter(Boolean)[0] : "klaida"}`);
    }
  }

  await db.setting.delete({ where: { key: draftKey(token) } }).catch(() => undefined);
  revalidatePath("/catalogue");
  revalidatePath("/outlet");
  revalidatePath("/admin/products");
  return result;
}
