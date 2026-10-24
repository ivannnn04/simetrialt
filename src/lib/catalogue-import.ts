import * as XLSX from "xlsx";

/**
 * Parsing and column mapping for supplier price lists (CSV / Excel). Supplier files use
 * their own headers in English, Lithuanian or Italian, so columns are matched by synonyms and
 * the admin can override the mapping before anything is written.
 */

export const FIELDS = [
  "sku",
  "name",
  "price",
  "sale_price",
  "currency",
  "category",
  "brand",
  "typology",
  "material",
  "colour",
  "description",
  "in_showroom",
  "published",
  "image_url",
] as const;
export type Field = (typeof FIELDS)[number];

export const FIELD_LABELS: Record<Field, string> = {
  sku: "SKU / kodas",
  name: "Pavadinimas",
  price: "Kaina",
  sale_price: "Akcijos kaina",
  currency: "Valiuta",
  category: "Kategorija",
  brand: "Prekės ženklas",
  typology: "Tipologija",
  material: "Medžiaga",
  colour: "Spalva",
  description: "Aprašymas",
  in_showroom: "Yra salone",
  published: "Paskelbti",
  image_url: "Nuotraukos nuoroda",
};

/** Header synonyms (lower-cased, punctuation stripped) per field. */
const SYNONYMS: Record<Field, string[]> = {
  sku: ["sku", "code", "kodas", "prekes kodas", "article", "art", "art nr", "artikelnummer", "codice", "ref", "reference", "item code", "item no", "product code", "model", "modelis"],
  name: ["name", "pavadinimas", "product", "product name", "produktas", "preke", "item", "item name", "description short", "title", "nome", "descrizione"],
  price: ["price", "kaina", "list price", "retail price", "rrp", "price eur", "prezzo", "unit price", "net price", "kaina eur", "pardavimo kaina"],
  sale_price: ["sale price", "sale_price", "akcijos kaina", "akcija", "discount price", "outlet price", "nuolaida", "special price"],
  currency: ["currency", "valiuta", "cur", "ccy"],
  category: ["category", "kategorija", "group", "grupe", "product group", "categoria", "family"],
  brand: ["brand", "prekes zenklas", "gamintojas", "manufacturer", "supplier", "tiekejas", "marca", "producer"],
  typology: ["typology", "tipologija", "type", "tipas", "product type", "collection", "kolekcija", "series", "serija"],
  material: ["material", "materials", "medziaga", "finish", "apdaila", "materiale"],
  colour: ["colour", "color", "spalva", "colore", "farbe"],
  description: ["description", "aprasymas", "long description", "details", "notes", "pastabos", "descrizione lunga"],
  in_showroom: ["in showroom", "in_showroom", "showroom", "salone", "eksponuojama", "on display"],
  published: ["published", "paskelbta", "publish", "active", "aktyvus", "visible", "rodyti"],
  image_url: ["image", "image url", "image_url", "photo", "nuotrauka", "picture", "img", "foto", "immagine"],
};

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Best-guess field for a header, or null when nothing matches. */
export function guessField(header: string): Field | null {
  const h = norm(header);
  if (!h) return null;
  for (const field of FIELDS) {
    if (SYNONYMS[field].includes(h)) return field;
  }
  for (const field of FIELDS) {
    if (SYNONYMS[field].some((s) => h.includes(s) || s.includes(h))) return field;
  }
  return null;
}

/**
 * Field per header, each field used once. When two headers compete for a field the exact synonym
 * wins (a "Materials" column beats "Finish"), otherwise the first column.
 */
export function guessMapping(headers: string[]): (Field | "")[] {
  const exact = headers.map((h) => {
    const n = norm(h);
    return FIELDS.find((f) => SYNONYMS[f].includes(n)) ?? null;
  });
  const guess = headers.map((h) => guessField(h) ?? "");
  const taken = new Map<string, number>();
  for (let i = 0; i < guess.length; i++) {
    const f = guess[i];
    if (!f) continue;
    const prev = taken.get(f);
    if (prev === undefined) taken.set(f, i);
    else if (exact[i] === f && exact[prev] !== f) {
      guess[prev] = "";
      taken.set(f, i);
    } else guess[i] = "";
  }
  // supplier lists often call the product name "Description": without a name column, use it as the name
  if (!taken.has("name") && taken.has("description")) guess[taken.get("description")!] = "name";
  return guess;
}

export type ParsedSheet = { headers: string[]; rows: string[][]; sheet?: string };

/** Reads CSV (comma, semicolon or tab) or Excel into a header row plus string rows. */
export function parseSpreadsheet(buffer: ArrayBuffer, filename: string): ParsedSheet {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".csv") || lower.endsWith(".txt")) {
    const text = new TextDecoder("utf-8").decode(buffer);
    const rows = parseCsv(text, detectDelimiter(text));
    return { headers: rows[0] ?? [], rows: rows.slice(1) };
  }
  const wb = XLSX.read(buffer, { type: "array" });
  // first sheet with at least a header and one row
  for (const name of wb.SheetNames) {
    const sheet = wb.Sheets[name];
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: "" });
    const cleaned = matrix.map((r) => r.map((c) => String(c ?? "").trim())).filter((r) => r.some(Boolean));
    if (cleaned.length >= 2) {
      // header = first row with at least two non-empty cells
      const hi = cleaned.findIndex((r) => r.filter(Boolean).length >= 2);
      return { headers: cleaned[hi] ?? [], rows: cleaned.slice(hi + 1), sheet: name };
    }
  }
  return { headers: [], rows: [] };
}

function detectDelimiter(text: string): string {
  const head = text.split(/\r?\n/).slice(0, 5).join("\n");
  const counts = [",", ";", "\t"].map((d) => [d, (head.match(new RegExp(`\\${d}`, "g")) ?? []).length] as const);
  return counts.sort((a, b) => b[1] - a[1])[0][0];
}

/** CSV parser with quoted-field support and a configurable delimiter. */
export function parseCsv(text: string, delimiter = ","): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === delimiter) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((f) => f.trim() !== "")) rows.push(row.map((f) => f.trim()));
      row = [];
    } else field += ch;
  }
  row.push(field);
  if (row.some((f) => f.trim() !== "")) rows.push(row.map((f) => f.trim()));
  return rows;
}

/** "1.234,50", "1,234.50", "€ 420", "420 EUR" → cents */
export function parsePriceCents(raw: string): number | null {
  let s = raw.replace(/[^\d.,-]/g, "");
  if (!s) return null;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > lastDot) s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(/,/g, "");
  const n = Number.parseFloat(s);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

export const truthy = (v: string) => ["true", "1", "yes", "taip", "y", "x", "✓"].includes(v.trim().toLowerCase());

/**
 * Candidate SKUs / slugs a photo may belong to, from its file name, most specific first:
 * "ABC-123_2.jpg" → ["ABC-123_2", "ABC-123"], "ABC-123.jpg" → ["ABC-123"].
 * Only "_N", " (N)" and named suffixes are stripped, so a hyphenated SKU keeps its digits.
 */
export function imageKeyCandidates(filename: string): string[] {
  const base = filename.replace(/\.[a-z0-9]+$/i, "").trim();
  const out = [base];
  const stripped = base
    .replace(/\s*\(\d+\)$/, "")
    .replace(/[_\s]+\d+$/, "")
    .replace(/[_\s-]+(front|back|side|top|detail|main|lifestyle)$/i, "")
    .trim();
  if (stripped && stripped !== base) out.push(stripped);
  return out;
}
