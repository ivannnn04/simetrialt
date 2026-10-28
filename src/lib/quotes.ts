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
