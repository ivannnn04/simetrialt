import { parseSpreadsheet } from "@/lib/catalogue-import";

/**
 * The supplier list ("List.xlsx"): one row per brand with the brand's website and the transport
 * surcharge added on top of the catalogue price (RRP). Columns are found by content, so the sheet
 * needs no particular headers: a cell with a URL, a cell with a number (the percentage) and a text
 * cell with the brand name.
 */

export type BrandInfo = { brand: string; website: string; transportPct: number };

const URL_RE = /^(https?:\/\/)?(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i;
const PCT_RE = /^\s*\+?\s*(\d+(?:[.,]\d+)?)\s*%?\s*$/;

export function parseBrandList(buffer: ArrayBuffer, filename: string): BrandInfo[] {
  const parsed = parseSpreadsheet(buffer, filename);
  const out: BrandInfo[] = [];
  for (const row of [parsed.headers, ...parsed.rows]) {
    const cells = row.map((c) => c.trim());
    const url = cells.find((c) => URL_RE.test(c) && /\./.test(c) && !/^\d/.test(c));
    if (!url) continue;
    const brand = cells.find((c) => c && c !== url && !PCT_RE.test(c) && /[a-z]/i.test(c) && c.length < 60);
    if (!brand) continue;
    const pctCell = cells.find((c) => c !== url && c !== brand && PCT_RE.test(c) && c !== "");
    const pct = pctCell ? Number.parseFloat(pctCell.match(PCT_RE)![1].replace(",", ".")) : 0;
    out.push({ brand, website: url.startsWith("http") ? url : `https://${url}`, transportPct: Number.isFinite(pct) ? pct : 0 });
  }
  return out;
}

/** A sheet is the supplier list (not a price list) when most of its rows carry a website. */
export function looksLikeBrandList(buffer: ArrayBuffer, filename: string): boolean {
  const parsed = parseSpreadsheet(buffer, filename);
  const rows = [parsed.headers, ...parsed.rows].filter((r) => r.some(Boolean));
  if (rows.length === 0 || rows.length > 300) return false;
  const withUrl = rows.filter((r) => r.some((c) => URL_RE.test(c.trim()) && /\./.test(c))).length;
  const hasSkuHeader = parsed.headers.some((h) => /sku|art\.?\s*no|article|kodas|code/i.test(h));
  return withUrl >= 1 && withUrl >= rows.length * 0.3 && !hasSkuHeader;
}

const words = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);

/**
 * Finds the brand of a document: the form field first, else the brand whose name (its words of three
 * letters or more) appears in the document text or file name. "Catellani & Smith" is found in
 * "2026-2027_Catellani__Smith_price_list.pdf" as well as in "CATELLANI&SMITH".
 */
export function matchBrand(list: BrandInfo[], hints: { brand?: string; text?: string; filename?: string }): BrandInfo | null {
  if (list.length === 0) return null;
  const score = (b: BrandInfo, hayWords: string[], hayJoined: string) => {
    const w = words(b.brand).filter((x) => x.length >= 3);
    if (!w.length) return 0;
    const set = new Set(hayWords);
    const found = w.filter((x) => set.has(x) || (x.length >= 5 && hayJoined.includes(x)));
    // the first word is the brand itself ("FLOS Deco …", "Moooi CARPETS"); the rest refine the match
    if (!found.includes(w[0])) return 0;
    return found.length * 10 + w[0].length;
  };
  const pick = (hay: string) => {
    const hw = words(hay);
    const hj = hw.join("");
    return list.map((b) => ({ b, s: score(b, hw, hj) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s)[0]?.b ?? null;
  };
  if (hints.brand) {
    const hit = pick(hints.brand);
    if (hit) return hit;
  }
  return pick(`${hints.filename ?? ""} ${hints.text ?? ""}`);
}
