/** Quote arithmetic shared by the editor (client) and the print view (server). Amounts in cents, VAT included. */

export type QuoteLine = { unitCents: number; quantity: number; discountPct: number };

export const VAT_PCT = Number.parseFloat(process.env.NEXT_PUBLIC_VAT_PERCENT ?? "21") || 21;

const pct = (n: number) => Math.min(100, Math.max(0, Number.isFinite(n) ? n : 0));

/** Line total after its own discount. */
export function lineTotal(l: QuoteLine): number {
  return Math.round(l.unitCents * Math.max(0, l.quantity) * (1 - pct(l.discountPct) / 100));
}

export function quoteTotals(lines: QuoteLine[], discountPct: number) {
  const list = lines.reduce((n, l) => n + l.unitCents * Math.max(0, l.quantity), 0);
  const afterLines = lines.reduce((n, l) => n + lineTotal(l), 0);
  const cartDiscount = Math.round(afterLines * (pct(discountPct) / 100));
  const total = afterLines - cartDiscount;
  const vat = Math.round(total - total / (1 + VAT_PCT / 100));
  return { list, lineDiscount: list - afterLines, afterLines, cartDiscount, total, vat, net: total - vat };
}

export const quoteNumber = (n: number) => `P-${String(n).padStart(4, "0")}`;

export const QUOTE_STATUS: Record<string, { label: string; tone: "zinc" | "blue" | "green" | "amber" }> = {
  DRAFT: { label: "Juodraštis", tone: "zinc" },
  SENT: { label: "Išsiųstas", tone: "blue" },
  ACCEPTED: { label: "Priimtas", tone: "green" },
  DECLINED: { label: "Atmestas", tone: "amber" },
};

/** A room / floor of the project inside a quote; lines point to it by `sectionId`. */
export type QuoteSection = { id: string; name: string; note: string; sort: number };

export const QUOTE_SECTIONS_MAX = 50;
export const QUOTE_SECTION_NAME_MAX = 120;
export const QUOTE_SECTION_NOTE_MAX = 5000;
export const QUOTE_NOTE_MAX = 5000;
export const UNSORTED_LABEL = "Be skyriaus";

/** Reads `Quote.sections` (JSON) safely: well-formed entries only, unique ids, in their saved order. */
export function parseQuoteSections(raw: unknown): QuoteSection[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: QuoteSection[] = [];
  for (const s of raw) {
    if (!s || typeof s !== "object") continue;
    const r = s as Record<string, unknown>;
    const id = typeof r.id === "string" ? r.id.trim().slice(0, 40) : "";
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      name: (typeof r.name === "string" ? r.name.trim() : "").slice(0, QUOTE_SECTION_NAME_MAX) || `Skyrius ${out.length + 1}`,
      note: (typeof r.note === "string" ? r.note : "").slice(0, QUOTE_SECTION_NOTE_MAX),
      sort: typeof r.sort === "number" && Number.isFinite(r.sort) ? r.sort : out.length,
    });
    if (out.length >= QUOTE_SECTIONS_MAX) break;
  }
  return out.sort((a, b) => a.sort - b.sort).map((s, i) => ({ ...s, sort: i }));
}

/**
 * Lines grouped by section in the sections' order, lines without a (known) section last as "Be skyriaus".
 * Without sections there is one group with `section: null` holding every line, as before.
 */
export function groupQuoteLines<T extends { sectionId?: string | null }>(lines: T[], sections: QuoteSection[]): { section: QuoteSection | null; lines: T[] }[] {
  if (!sections.length) return [{ section: null, lines }];
  const ids = new Set(sections.map((s) => s.id));
  const groups: { section: QuoteSection | null; lines: T[] }[] = sections.map((s) => ({ section: s, lines: lines.filter((l) => l.sectionId === s.id) }));
  const unsorted = lines.filter((l) => !l.sectionId || !ids.has(l.sectionId));
  if (unsorted.length) groups.push({ section: null, lines: unsorted });
  return groups;
}
