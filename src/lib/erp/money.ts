/** Line and document arithmetic. Prices are net (ex VAT) cents; VAT is added per line. */

export type LineLike = { qty: number; priceCents: number; discountPct: number; vatPct: number; costCents?: number };

const clampPct = (n: number) => Math.min(100, Math.max(0, Number.isFinite(n) ? n : 0));

export const lineNet = (l: LineLike) => Math.round(l.qty * l.priceCents * (1 - clampPct(l.discountPct) / 100));
export const lineCost = (l: LineLike) => Math.round(l.qty * (l.costCents ?? 0));

export function docTotals(lines: LineLike[], discountPct = 0) {
  const k = 1 - clampPct(discountPct) / 100;
  const net = lines.reduce((n, l) => n + Math.round(lineNet(l) * k), 0);
  const vat = lines.reduce((n, l) => n + Math.round(lineNet(l) * k * (l.vatPct / 100)), 0);
  const cost = lines.reduce((n, l) => n + lineCost(l), 0);
  // margin is earned on the goods: negative lines (deducted prepayments) are not lost revenue
  const goods = lines.reduce((n, l) => n + (l.priceCents > 0 ? Math.round(lineNet(l) * k) : 0), 0);
  const margin = goods - cost;
  return { net, vat, total: net + vat, cost, goods, margin, marginPct: goods ? (margin / goods) * 100 : 0 };
}

export const eur = (cents: number) =>
  `${(cents / 100).toLocaleString("lt-LT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

export const pct = (n: number) => `${n.toLocaleString("lt-LT", { maximumFractionDigits: 1 })} %`;

export const fmtDate = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : "");

// ---------- amount in Lithuanian words (KPO, invoices) ----------
const ONES = ["", "vienas", "du", "trys", "keturi", "penki", "šeši", "septyni", "aštuoni", "devyni"];
const TEENS = ["dešimt", "vienuolika", "dvylika", "trylika", "keturiolika", "penkiolika", "šešiolika", "septyniolika", "aštuoniolika", "devyniolika"];
const TENS = ["", "", "dvidešimt", "trisdešimt", "keturiasdešimt", "penkiasdešimt", "šešiasdešimt", "septyniasdešimt", "aštuoniasdešimt", "devyniasdešimt"];

function under1000(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  const parts: string[] = [];
  if (h) parts.push(h === 1 ? "šimtas" : `${ONES[h]} šimtai`);
  if (r >= 10 && r < 20) parts.push(TEENS[r - 10]);
  else {
    if (Math.floor(r / 10)) parts.push(TENS[Math.floor(r / 10)]);
    if (r % 10) parts.push(ONES[r % 10]);
  }
  return parts.join(" ");
}

/** Lithuanian form of a counted noun: 1 → one, 2–9 → few, 0/10–20/x0 → many. */
function form(n: number, [one, few, many]: [string, string, string]) {
  const t = n % 100;
  const u = n % 10;
  if (t >= 10 && t <= 20) return many;
  if (u === 1) return one;
  if (u === 0) return many;
  return few;
}

export function numberToLtWords(n: number): string {
  n = Math.floor(Math.abs(n));
  if (n === 0) return "nulis";
  const groups: [number, [string, string, string]][] = [
    [1_000_000_000, ["milijardas", "milijardai", "milijardų"]],
    [1_000_000, ["milijonas", "milijonai", "milijonų"]],
    [1_000, ["tūkstantis", "tūkstančiai", "tūkstančių"]],
  ];
  const parts: string[] = [];
  for (const [size, names] of groups) {
    const g = Math.floor(n / size);
    if (g) {
      parts.push(`${under1000(g)} ${form(g, names)}`);
      n %= size;
    }
  }
  if (n) parts.push(under1000(n));
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

/** "1 234,56 €" → "vienas tūkstantis du šimtai trisdešimt keturi eurai 56 ct" */
export function amountInWords(cents: number): string {
  const e = Math.floor(Math.abs(cents) / 100);
  const c = Math.abs(cents) % 100;
  const words = numberToLtWords(e);
  return `${words.charAt(0).toUpperCase()}${words.slice(1)} ${form(e, ["euras", "eurai", "eurų"])} ${String(c).padStart(2, "0")} ct`;
}
