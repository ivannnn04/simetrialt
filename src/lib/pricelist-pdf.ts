import { getDocumentProxy } from "unpdf";

/**
 * Reads a supplier *price list* PDF: pages of text where each product line starts with an article
 * number and ends with a price, grouped under headers that name the product family and its type,
 * e.g.
 *
 *   Lederam C180 / ceiling lamp / 110V (available with 1x14W LED board) or 230V
 *   LC1803 / shade Ø 80 cm black/gold / black rod / gold disc / 1x15W LED board      €   1.140,00
 *
 * Two-column pages are split by the x position of the article numbers before the lines are rebuilt,
 * so the right column never interleaves with the left one.
 */

export type PriceListRow = {
  sku: string;
  /** product family / model as printed in the header, e.g. "Lederam C180" */
  family: string;
  /** rest of the header, e.g. "ceiling lamp / 110V (available with 1x14W LED board) or 230V" */
  type: string;
  /** the product line without the article number and the price */
  desc: string;
  /** catalogue price as printed (net) */
  price: number;
  page: number;
  /** when known separately: the option words for the name (finish / colour / size) … */
  variant?: string;
  /** … and the specification lines for the description */
  spec?: string;
  designer?: string;
};

type Word = { x0: number; y: number; x1: number; text: string };

/** Article numbers: letters and digits, no spaces, starting with a letter ("LC1803", "P188JC", "SG9"). */
const SKU_RE = /^[A-Z][A-Z0-9.\-/]{2,}$/;
/** A line that ends with a price: "€ 1.140,00", "1.140,00 €", "EUR 1,140.00", "1140.00" (two decimals). */
const PRICE_END_RE = /(?:(€|eur|usd|\$|£)\s*)?(\d{1,3}(?:[.\s]\d{3})*(?:,\d{2})|\d{1,3}(?:,\d{3})*(?:\.\d{2})|\d+(?:[.,]\d{2}))\s*(€|eur|usd|\$|£)?\s*$/i;
/** Lines that are notes rather than headers. */
const NOTE_RE = /^(\*|note|also available|available on|on request|further|customi[sz]able|price|prices|all prices|iva|vat|flex\b)/i;
/** A header names what the products are ("… / wall lamp / …", "… / sofa / …"). */
const TYPE_WORD_RE = /\b(lamp|lamps|light|lights|chandelier|luminaire|spot|spotlight|bollard|profile|sofa|armchair|chair|stool|table|desk|bed|shelf|shelving|bookcase|cabinet|sideboard|console|mirror|rug|carpet|vase|bench|cushion|pouf|ottoman|daybed|wardrobe|flex|holder|system|kit|accessor)/i;

const parsePrice = (raw: string): number => {
  let s = raw.replace(/\s/g, "");
  if (/,\d{2}$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(/,/g, "");
  return Number.parseFloat(s);
};

/** Groups the words of one column into lines by their vertical centre, each line sorted left to right. */
function toLines(words: Word[]): string[] {
  const lines: string[] = [];
  let current: Word[] = [];
  let lastY: number | null = null;
  for (const w of [...words].sort((a, b) => a.y - b.y || a.x0 - b.x0)) {
    if (lastY !== null && w.y - lastY > 4.5) {
      lines.push(current.sort((a, b) => a.x0 - b.x0).map((x) => x.text).join(" "));
      current = [];
    }
    current.push(w);
    lastY = w.y;
  }
  if (current.length) lines.push(current.sort((a, b) => a.x0 - b.x0).map((x) => x.text).join(" "));
  return lines.map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean);
}

/** Parses the lines of one column into price rows, carrying the family / type header along. */
export function parsePriceLines(lines: string[], page: number): PriceListRow[] {
  const rows: PriceListRow[] = [];
  let family = "";
  let type = "";
  for (const raw of lines) {
    const line = raw.trim();
    const first = (line.split(/\s+/)[0] ?? "").replace(/[/–—-]+$/, "");
    const pm = line.match(PRICE_END_RE);
    const hasCurrency = Boolean(pm && (pm[1] || pm[3]));
    if (SKU_RE.test(first) && /^\S+\s*[/–—-]\s/.test(line) && pm && (hasCurrency || /[.,]\d{2}$/.test(line))) {
      const segs = line
        .slice(0, pm.index)
        .slice(first.length)
        .replace(/^\s*[/–—-]\s*/, "")
        .replace(/[\s/–—-]+$/, "")
        .split(/\s+\/\s+/)
        .map((x) => x.trim())
        .filter(Boolean);
      // a line printed twice (hidden text layer) repeats its segments
      const body = segs.filter((x, i) => segs.indexOf(x) === i).join(" / ");
      const price = parsePrice(pm[2]);
      if (Number.isFinite(price) && price > 0) rows.push({ sku: first, family, type, desc: body, price, page });
      continue;
    }
    // header: "Family / type / voltage" – no price, starts with a capital letter, not a note
    if (!pm && line.includes(" / ") && /^[A-ZÀ-Ý0-9]/.test(line) && !SKU_RE.test(first) && !NOTE_RE.test(line) && TYPE_WORD_RE.test(line) && line.length < 160) {
      const i = line.indexOf(" / ");
      family = line.slice(0, i).trim();
      type = line.slice(i + 3).trim();
    }
  }
  return rows;
}

export async function extractPriceListPdf(data: ArrayBuffer): Promise<{ rows: PriceListRow[]; text: string; pages: number }> {
  // pdf.js takes ownership of the buffer it is given: work on a copy so the caller can read the file again
  const pdf = await getDocumentProxy(new Uint8Array(data.slice(0)));
  const rows: PriceListRow[] = [];
  const textParts: string[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    // a photo catalogue has no price lines at all: give up after a while instead of reading every page
    if (p > 25 && rows.length === 0) break;
    const page = await pdf.getPage(p);
    const pageHeight = page.view[3] - page.view[1];
    const pageWidth = page.view[2] - page.view[0];
    const content = await page.getTextContent();
    type Item = { str: string; transform: number[]; width: number; height: number };
    const words: Word[] = [];
    for (const it of content.items as Item[]) {
      if (typeof it.str !== "string" || !it.str.trim()) continue;
      const x0 = it.transform[4];
      const y = pageHeight - it.transform[5] - (it.height || 0) / 2;
      // pdf.js often returns a whole phrase as one item: split it into words with estimated positions
      const str = it.str;
      const perChar = (it.width || 0) / Math.max(1, str.length);
      for (const m of str.matchAll(/\S+/g)) {
        const wx0 = x0 + m.index! * perChar;
        words.push({ x0: wx0, y, x1: wx0 + m[0].length * perChar, text: m[0] });
      }
    }
    if (p <= 3) textParts.push(words.map((w) => w.text).join(" "));

    // column split: article numbers that start a line in the right half of the page
    const starts: number[] = [];
    for (const w of words) {
      if (!SKU_RE.test(w.text) || w.text === "IVA" || w.y < 40) continue;
      const after = words.find((o) => Math.abs(o.y - w.y) < 3 && o.x0 > w.x1 - 1 && o.x0 < w.x1 + 12);
      if (!after || !/^[/–—-]/.test(after.text)) continue;
      const before = words.some((o) => Math.abs(o.y - w.y) < 3 && o.x1 > w.x0 - 14 && o.x1 <= w.x0 + 0.5 && o !== w);
      if (!before && w.x0 >= pageWidth * 0.4) starts.push(w.x0);
    }
    const splitX = starts.length ? Math.min(...starts) - 2 : Number.POSITIVE_INFINITY;
    const left = words.filter((w) => w.x0 < splitX);
    const right = words.filter((w) => w.x0 >= splitX);
    rows.push(...parsePriceLines(toLines(left), p));
    if (right.length) rows.push(...parsePriceLines(toLines(right), p));
  }
  // the same article number printed twice (e.g. in a summary table) keeps its first occurrence
  const seen = new Set<string>();
  return { rows: rows.filter((r) => (seen.has(r.sku) ? false : (seen.add(r.sku), true))), text: textParts.join("\n"), pages: pdf.numPages };
}
