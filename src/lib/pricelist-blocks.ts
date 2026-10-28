import sharp from "sharp";
import { extractImages, getDocumentProxy, getResolvedPDFJS } from "unpdf";
import type { PriceListRow } from "@/lib/pricelist-pdf";

/**
 * Reads a *block* price list: several products per page, each printed as a product title with its
 * designer, a column of specifications (power, voltage, light source, materials, weight, a drawing
 * with dimensions) and a small table of finishes with the article code and the price per finish:
 *
 *   GUSTAVE                       Finishes            Colors        € excl. VAT
 *   Vincent Van Duysen, 2022      matte anthracite    09.8405.DR    293,00
 *   Power 2,5W                    matte white         09.8405.DY    293,00
 *
 * The index pages ("TABLE LAMPS … Gustave P. 20") give each product its type.
 */

export type BlockRow = PriceListRow & {
  finish: string;
  designer: string;
  materials: string;
  lightSource: string;
  weight: string;
  dimensions: string;
  images: string[];
};

type Item = { x: number; y: number; w: number; size: number; text: string };

const PRICE_RE = /^(\d{1,3}(?:[.\s]\d{3})*,\d{2}|\d{1,3}(?:,\d{3})*\.\d{2}|\d+[.,]\d{2})$/;
const CODE_RE = /^(?=(?:.*\d){3})[A-Z0-9][A-Z0-9.\-/]{4,}$/;
const TABLE_HEAD_RE = /^(finiture|finishes?|finish|colori|colou?rs?|codice|code|art\.?\s*no\.?|articolo|article|sku)\b/i;
const LABEL_RE = /\b(potenza|power|tensione|voltage|fonte luminosa|light source|materiali|materials|peso|weight|dimensioni|dimensions|lumen|cri|colou?r temperature)\b/i;
const DIM_RE = /^[øØ]?\s*\d+(?:[.,]\d+)?\s*(?:x\s*\d+(?:[.,]\d+)?\s*)*(?:mm|cm|m)$/i;
const NOTE_RE = /^(\*|per le|for the|rosone|ceiling rose|this lamp|questa lampada|lampadina|bulb)/i;

/** "nero opaco · matte black" → "matte black" (the last language in a bilingual cell). */
const lastLanguage = (s: string) => s.split(/\s*·\s*|\s*\/\s*(?=[a-z])/i).map((x) => x.trim()).filter(Boolean).pop() ?? s.trim();
const titleCase = (s: string) =>
  s
    .toLowerCase()
    .replace(/(^|[\s\-/(])([a-zà-ÿ])/g, (m, pre, ch) => pre + ch.toUpperCase())
    .replace(/\bIc\b/g, "IC")
    .trim();
const isUpper = (s: string) => {
  const letters = s.match(/[A-Za-zÀ-ÿ]/g) ?? [];
  return letters.length >= 3 && letters.filter((c) => c === c.toUpperCase()).length >= letters.length * 0.9;
};
const singular = (section: string) =>
  section
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\b(lamps|lights|luminaires|chandeliers)\b/g, (w) => w.slice(0, -1))
    .trim();

function linesOf(items: Item[]): Item[][] {
  const rows: Item[][] = [];
  for (const it of [...items].sort((a, b) => a.y - b.y || a.x - b.x)) {
    const row = rows.find((r) => Math.abs(r[0].y - it.y) <= 2);
    if (row) row.push(it);
    else rows.push([it]);
  }
  return rows.map((r) => r.sort((a, b) => a.x - b.x));
}
const text = (its: Item[]) => {
  let out = "";
  let end = -1;
  for (const i of its) {
    const gap = end < 0 ? 0 : i.x - end;
    out += (out && gap >= 1.2 ? " " : "") + i.text;
    end = i.x + i.w;
  }
  return out.replace(/\s+/g, " ").trim();
};
/** A bilingual title ("STRING LIGHT TESTA A CONO · CONE HEAD") keeps the shared prefix and the last language. */
const bilingualTitle = (t: string) => {
  const parts = t.split(/\s*·\s*/);
  if (parts.length !== 2) return t;
  const a = parts[0].split(" ");
  const b = parts[1].split(" ");
  return a.length > b.length ? [...a.slice(0, a.length - b.length), ...b].join(" ") : parts[1];
};
const stripLabels = (s: string) => s.replace(/^(\s*[\wÀ-ÿ ]*?\b(potenza|power|tensione|voltage|fonte luminosa|light source|materiali|materials|peso|weight)\b[\s·:]*)+/i, "").trim();

/** Index pages: a large section heading ("TABLE LAMPS") above product names with "P. 12" page references. */
function readIndex(items: Item[], index: { name: string; section: string; pages: number[] }[], state: { section: string }): boolean {
  const refs = items.filter((i) => /^P\.\s*\d+/i.test(i.text));
  if (refs.length < 2) return false;
  const headings = items.filter((i) => i.size >= 14 && isUpper(i.text)).sort((a, b) => a.y - b.y);
  for (const ref of refs.sort((a, b) => a.y - b.y)) {
    // the chapter is the heading printed above the entry; entries above the first heading belong to the previous chapter
    const above = headings.filter((h) => h.y < ref.y).pop();
    if (above) state.section = above.text.replace(/\s+/g, " ").trim();
    // the product name sits right above the reference, roughly at the same x
    const name = items.filter((i) => i.y < ref.y && ref.y - i.y < 20 && Math.abs(i.x + i.w / 2 - (ref.x + ref.w / 2)) < 60 && !/^P\./i.test(i.text) && i.size < 14).sort((a, b) => b.y - a.y)[0];
    if (!name) continue;
    const pages = [...ref.text.matchAll(/\d+/g)].map((m) => Number(m[0]));
    const span = pages.length === 2 ? Array.from({ length: pages[1] - pages[0] + 1 }, (_, k) => pages[0] + k) : pages;
    index.push({ name: name.text.trim(), section: state.section, pages: span });
  }
  if (headings.length) state.section = headings[headings.length - 1].text.replace(/\s+/g, " ").trim();
  return true;
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export async function extractBlockPriceList(data: ArrayBuffer, opts: { withImages?: boolean } = {}): Promise<{ rows: BlockRow[]; pages: number; text: string; index: { name: string; section: string; pages: number[] }[] }> {
  const withImages = opts.withImages ?? true;
  const pdf = await getDocumentProxy(new Uint8Array(data.slice(0)));
  const pdfjs = await getResolvedPDFJS();
  const OPS = pdfjs.OPS;
  const rows: BlockRow[] = [];
  const index: { name: string; section: string; pages: number[] }[] = [];
  const indexState = { section: "" };
  const textParts: string[] = [];
  let printedOffset: number | null = null; // printed page number − pdf page
  let carry = ""; // title of the last block, for rows continued at the top of the next page

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const pageHeight = page.view[3] - page.view[1];
    const content = await page.getTextContent();
    type Raw = { str: string; transform: number[]; width: number };
    const items: Item[] = [];
    for (const it of content.items as Raw[]) {
      if (typeof it.str !== "string" || !it.str.trim()) continue;
      if (it.transform[0] === 0 && it.transform[1] !== 0) continue; // rotated margin text
      items.push({ x: it.transform[4], y: pageHeight - it.transform[5], w: it.width || 0, size: Math.abs(it.transform[0]) || Math.abs(it.transform[1]) || 0, text: it.str.trim() });
    }
    if (p <= 3) textParts.push(items.map((i) => i.text).join(" "));
    if (readIndex(items, index, indexState)) continue;

    // the finish table starts at the x of its header ("Finiture / Finishes")
    const heads = items.filter((i) => TABLE_HEAD_RE.test(i.text) && i.size < 9);
    if (!heads.length) continue;
    const tableX = Math.min(...heads.map((i) => i.x)) - 2;
    const lines = linesOf(items);

    // printed page number (small number near the bottom) → offset to the index's page references
    const pn = items.find((i) => i.y > pageHeight * 0.9 && /^\d(\s?\d){0,2}$/.test(i.text));
    if (pn && printedOffset === null) printedOffset = Number(pn.text.replace(/\s/g, "")) - p;

    // product titles: upper-case lines left of the table
    type Title = { y: number; text: string };
    const titles: Title[] = [];
    for (const line of lines) {
      const left = line.filter((i) => i.x < tableX && !DIM_RE.test(i.text) && (i.size >= 7 || isUpper(i.text)));
      const big = left.filter((i) => i.size >= 7 && i.size <= 14);
      if (!big.length || !isUpper(text(big)) || LABEL_RE.test(text(big)) || NOTE_RE.test(text(big))) continue;
      const t = bilingualTitle(text(left).replace(/\s*\*+\s*$/, "").replace(/\s+/g, " ").trim());
      if (t.length < 3 || /^\d/.test(t) || /accessor|ricambi|spare parts|offline exclusive/i.test(t)) continue;
      // a title broken over two lines ("ARRANGEMENTS - ROUND MEDIUM -" / "SET OF 2")
      const prev = titles[titles.length - 1];
      if (prev && line[0].y - prev.y < 14 && /[-–]$/.test(prev.text)) prev.text = `${prev.text} ${t}`.replace(/\s*[-–]\s+/g, " - ");
      else titles.push({ y: line[0].y, text: t });
    }
    if (carry && (!titles.length || lines.some((l) => l[0].y < titles[0].y - 4 && l.some((i) => i.x >= tableX && CODE_RE.test(i.text.replace(/\*+$/, "")))))) titles.unshift({ y: -1, text: carry });
    if (!titles.length) continue;
    carry = titles[titles.length - 1].text;

    const blockOf = (y: number) => {
      let k = -1;
      for (const [i, t] of titles.entries()) if (y >= t.y - 4) k = i;
      return k;
    };
    type Block = { title: string; y: number; rows: BlockRow[]; spec: Item[][]; dims: string[]; accessory: boolean };
    const blocks: Block[] = titles.map((t) => ({ title: t.text, y: t.y, rows: [], spec: [], dims: [], accessory: false }));

    let lastRowY = -100;
    for (const line of lines) {
      const k = blockOf(line[0].y);
      if (k < 0) continue;
      const b = blocks[k];
      const tableItems = line.filter((i) => i.x >= tableX);
      const leftItems = line.filter((i) => i.x < tableX);
      if (leftItems.length) b.spec.push(leftItems);
      b.dims.push(...leftItems.filter((i) => DIM_RE.test(i.text)).map((i) => i.text));
      if (!tableItems.length) continue;
      const code = tableItems.find((i) => CODE_RE.test(i.text.replace(/\*+$/, "")) && !PRICE_RE.test(i.text));
      const price = tableItems.find((i) => PRICE_RE.test(i.text) && (!code || i.x > code.x));
      if (code && price) {
        if (b.accessory) continue;
        const finish = lastLanguage(text(tableItems.filter((i) => i.x < code.x)));
        const n = Number.parseFloat(price.text.replace(/\s/g, "").replace(/\.(?=\d{3})/g, "").replace(",", "."));
        if (Number.isFinite(n) && n > 0) b.rows.push({ sku: code.text.replace(/\*+$/, ""), family: "", type: "", desc: "", price: n, page: p, finish, designer: "", materials: "", lightSource: "", weight: "", dimensions: "", images: [] });
      } else {
        const t = text(tableItems);
        const last = b.rows[b.rows.length - 1];
        // a sub-heading inside the table ("POWER CABLE", "ACCESSORIES") opens the accessory rows
        if (TABLE_HEAD_RE.test(t)) b.accessory = false;
        else if (isUpper(t) && !/€|vat|iva/i.test(t)) b.accessory = true;
        else if (last && !b.accessory && line[0].y - lastRowY < 9 && !/€|\d{2},\d{2}/.test(t)) last.finish = `${last.finish} ${lastLanguage(t)}`.trim();
      }
      if (code && price) lastRowY = line[0].y;
    }

    // specifications from the left column
    for (const b of blocks) {
      if (!b.rows.length) continue;
      const specLines = b.spec.map((its) => text(its.filter((i) => !DIM_RE.test(i.text)))).filter((t) => t && !isUpper(t));
      const grab = (re: RegExp, nextLines = 0) => {
        const i = specLines.findIndex((t) => re.test(t));
        if (i < 0) return "";
        const same = stripLabels(specLines[i].replace(re, "").replace(/^[\s·:]+/, "").trim());
        const more: string[] = [];
        for (const t of specLines.slice(i + 1, i + 1 + nextLines)) {
          if (LABEL_RE.test(t) || NOTE_RE.test(t) || DIM_RE.test(t)) break;
          more.push(t);
        }
        return [same, ...more].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
      };
      const designer = specLines.find((t) => /^[A-ZÀ-Ý][^,]{2,60},\s*(19|20)\d\d$/.test(t)) ?? "";
      const power = grab(/^.*?\b(potenza|power)\b/i);
      const voltage = grab(/^.*?\b(tensione|voltage)\b/i);
      const light = lastLanguage(grab(/^.*?\b(fonte luminosa|light source)\b/i, 3)).replace(/^led included\s*/i, "");
      const materials = lastLanguage(grab(/^.*?\b(materiali|materials)\b/i, 2));
      const weight = grab(/^.*?\b(peso|weight)\b/i);
      const dims = [...new Set(b.dims.map((t) => t.replace(/\s+/g, " ").trim()))].join(", ");
      const family = titleCase(b.title);
      const printed = printedOffset !== null ? p + printedOffset : null;
      const nameHit = (e: { name: string }) => norm(family).startsWith(norm(e.name)) || norm(e.name).startsWith(norm(family));
      const byName = index.filter(nameHit).sort((a, b) => b.name.length - a.name.length);
      const entry =
        byName.find((e) => printed !== null && e.pages.includes(printed)) ??
        byName[0] ??
        index.find((e) => printed !== null && e.pages.includes(printed) && norm(family).split(" ")[0] === norm(e.name).split(" ")[0]);
      // no entry (a name split over two index pages): the chapter whose page range holds this page
      let section = entry?.section ?? "";
      if (!section && printed !== null) {
        const ranges = new Map<string, { min: number; max: number }>();
        for (const e of index) {
          const r = ranges.get(e.section) ?? { min: Infinity, max: -Infinity };
          ranges.set(e.section, { min: Math.min(r.min, ...e.pages), max: Math.max(r.max, ...e.pages) });
        }
        section = [...ranges.entries()].find(([, r]) => printed >= r.min && printed <= r.max)?.[0] ?? "";
      }
      const type = section ? singular(section) : "";
      for (const r of b.rows) {
        r.family = family;
        r.type = type;
        r.designer = designer.replace(/,\s*(19|20)\d\d$/, "");
        r.materials = materials;
        r.lightSource = light;
        r.weight = weight;
        r.dimensions = dims;
        r.variant = r.finish;
        r.spec = [power && `Power: ${power}`, voltage && `Voltage: ${voltage}`, light && `Light source: ${light}`, materials && `Materials: ${materials}`, weight && `Weight: ${weight}`, dims && `Dimensions: ${dims}`].filter(Boolean).join("\n");
        r.desc = [r.finish, power && `power ${power}`, light && `light source ${light}`, materials && `materials ${materials}`].filter(Boolean).join(" / ");
      }
    }

    if (withImages) {
      const ops = await page.getOperatorList();
      const positions: number[] = [];
      let ctm = [1, 0, 0, 1, 0, 0];
      const stack: number[][] = [];
      for (let i = 0; i < ops.fnArray.length; i++) {
        const fn = ops.fnArray[i];
        const args = ops.argsArray[i] as number[];
        if (fn === OPS.save) stack.push(ctm);
        else if (fn === OPS.restore) ctm = stack.pop() ?? ctm;
        else if (fn === OPS.transform) ctm = mul(ctm, args);
        else if (fn === OPS.paintImageXObject || fn === OPS.paintInlineImageXObject) positions.push(pageHeight - (ctm[1] * 0.5 + ctm[3] * 0.5 + ctm[5]));
      }
      let extracted: Awaited<ReturnType<typeof extractImages>> = [];
      try {
        extracted = await extractImages(pdf, p);
      } catch {
        extracted = [];
      }
      for (const [n, img] of extracted.entries()) {
        if (img.width < 150 || img.height < 150) continue;
        const y = positions[n];
        const k = y === undefined ? 0 : blockOf(y);
        const b = blocks[k] ?? blocks[0];
        if (!b || !b.rows.length || b.rows[0].images.length >= 2) continue;
        const url = await toJpegDataUrl(img.data, img.width, img.height, img.channels);
        if (url) for (const r of b.rows) r.images.push(url);
      }
    }
    for (const b of blocks) rows.push(...b.rows);
  }
  const seen = new Set<string>();
  return { rows: rows.filter((r) => (seen.has(r.sku) ? false : (seen.add(r.sku), true))), pages: pdf.numPages, text: textParts.join("\n"), index };
}

function mul(m: number[], t: number[]): number[] {
  return [t[0] * m[0] + t[1] * m[2], t[0] * m[1] + t[1] * m[3], t[2] * m[0] + t[3] * m[2], t[2] * m[1] + t[3] * m[3], t[4] * m[0] + t[5] * m[2] + m[4], t[4] * m[1] + t[5] * m[3] + m[5]];
}

async function toJpegDataUrl(data: Uint8ClampedArray, width: number, height: number, channels: 1 | 3 | 4): Promise<string | null> {
  try {
    const buf = await sharp(Buffer.from(data.buffer, data.byteOffset, data.byteLength), { raw: { width, height, channels } })
      .flatten({ background: "#ffffff" })
      .resize({ width: 560, height: 560, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 78 })
      .toBuffer();
    return `data:image/jpeg;base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}
