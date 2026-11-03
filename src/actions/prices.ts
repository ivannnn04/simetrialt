"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

/**
 * Supplier price changes for a whole brand: every product of the brand gets its price (and sale
 * price, and optionally the purchase cost) changed by a percentage, rounded as chosen. Each change
 * keeps the previous prices in a Setting row ("pricechange:<id>") so it can be undone.
 */

export type Rounding = "cent" | "euro" | "ten";
export type PriceChangeInput = { brand: string; percent: number; rounding: Rounding; includeSale: boolean; includeCost: boolean };
export type PriceChangeLog = {
  id: string;
  at: string;
  by: string;
  brand: string;
  percent: number;
  rounding: Rounding;
  includeSale: boolean;
  includeCost: boolean;
  count: number;
  undoneAt?: string;
};
type Snapshot = { id: string; p: number; s: number | null; c: number | null }[];

const KEY = (id: string) => `pricechange:${id}`;
const LOG_KEY = "pricechange:log";

const roundCents = (cents: number, r: Rounding) => (r === "ten" ? Math.round(cents / 1000) * 1000 : r === "euro" ? Math.round(cents / 100) * 100 : Math.round(cents));
const apply = (cents: number, i: PriceChangeInput) => Math.max(0, roundCents(cents * (1 + i.percent / 100), i.rounding));

function check(i: PriceChangeInput): string | null {
  if (!i.brand) return "Pasirinkite prekės ženklą.";
  if (!Number.isFinite(i.percent) || i.percent === 0) return "Įveskite pokytį procentais (pvz. 5 arba -3).";
  if (i.percent <= -90 || i.percent > 300) return "Pokytis turi būti tarp -90 % ir +300 %.";
  return null;
}

async function readLog(): Promise<PriceChangeLog[]> {
  const row = await db.setting.findUnique({ where: { key: LOG_KEY } });
  try {
    return row ? (JSON.parse(row.value) as PriceChangeLog[]) : [];
  } catch {
    return [];
  }
}
async function writeLog(log: PriceChangeLog[]) {
  const value = JSON.stringify(log.slice(0, 100));
  await db.setting.upsert({ where: { key: LOG_KEY }, create: { key: LOG_KEY, value }, update: { value } });
}

/** What the change would do: product count and a few examples, nothing is saved. */
export async function previewPriceChange(i: PriceChangeInput): Promise<{ error?: string; count?: number; examples?: { name: string; sku: string; before: number; after: number; saleBefore: number | null; saleAfter: number | null }[]; totalBefore?: number; totalAfter?: number }> {
  await requireAdmin();
  const err = check(i);
  if (err) return { error: err };
  const rows = await db.product.findMany({ where: { brand: i.brand }, select: { name: true, sku: true, priceCents: true, salePriceCents: true }, orderBy: { name: "asc" } });
  if (!rows.length) return { error: "Šio prekės ženklo produktų nėra." };
  return {
    count: rows.length,
    totalBefore: rows.reduce((n, r) => n + r.priceCents, 0),
    totalAfter: rows.reduce((n, r) => n + apply(r.priceCents, i), 0),
    examples: rows.slice(0, 8).map((r) => ({
      name: r.name,
      sku: r.sku ?? "",
      before: r.priceCents,
      after: apply(r.priceCents, i),
      saleBefore: r.salePriceCents,
      saleAfter: r.salePriceCents != null && i.includeSale ? apply(r.salePriceCents, i) : r.salePriceCents,
    })),
  };
}

export async function applyPriceChange(i: PriceChangeInput): Promise<{ error?: string; ok?: string }> {
  const me = await requireAdmin();
  const err = check(i);
  if (err) return { error: err };
  const factor = new Prisma.Decimal(1 + i.percent / 100);
  const id = randomBytes(6).toString("hex");
  const count = await db.$transaction(async (tx) => {
    const before = await tx.product.findMany({ where: { brand: i.brand }, select: { id: true, priceCents: true, salePriceCents: true, costCents: true } });
    if (!before.length) return 0;
    const snapshot: Snapshot = before.map((r) => ({ id: r.id, p: r.priceCents, s: r.salePriceCents, c: r.costCents }));
    await tx.setting.create({ data: { key: KEY(id), value: JSON.stringify(snapshot) } });
    // rounding in SQL: to the cent, the whole euro or the nearest 10 €
    const unit = i.rounding === "ten" ? 1000 : i.rounding === "euro" ? 100 : 1;
    const round = (col: string) => Prisma.raw(`GREATEST(0, ROUND("${col}" * ${factor.toString()} / ${unit}) * ${unit})::int`);
    await tx.$executeRaw`UPDATE "Product" SET "priceCents" = ${round("priceCents")}, "updatedAt" = NOW() WHERE "brand" = ${i.brand}`;
    if (i.includeSale) await tx.$executeRaw`UPDATE "Product" SET "salePriceCents" = ${round("salePriceCents")} WHERE "brand" = ${i.brand} AND "salePriceCents" IS NOT NULL`;
    if (i.includeCost) await tx.$executeRaw`UPDATE "Product" SET "costCents" = ${round("costCents")} WHERE "brand" = ${i.brand} AND "costCents" IS NOT NULL`;
    return before.length;
  });
  if (!count) return { error: "Šio prekės ženklo produktų nėra." };
  const log = await readLog();
  await writeLog([{ id, at: new Date().toISOString(), by: me.email, brand: i.brand, percent: i.percent, rounding: i.rounding, includeSale: i.includeSale, includeCost: i.includeCost, count }, ...log]);
  revalidatePath("/", "layout");
  return { ok: `${i.brand}: pakeistos ${count} produktų kainos (${i.percent > 0 ? "+" : ""}${i.percent} %).` };
}

/** Puts back the prices saved before a change (products deleted since are skipped). */
export async function undoPriceChange(id: string): Promise<{ error?: string; ok?: string }> {
  await requireAdmin();
  const row = await db.setting.findUnique({ where: { key: KEY(id) } });
  const log = await readLog();
  const entry = log.find((l) => l.id === id);
  if (!row || !entry) return { error: "Šio pakeitimo atšaukti nebegalima." };
  if (entry.undoneAt) return { error: "Šis pakeitimas jau atšauktas." };
  const later = log.find((l) => l.brand === entry.brand && !l.undoneAt && l.at > entry.at);
  if (later) return { error: "Po šio pakeitimo to paties prekės ženklo kainos keistos dar kartą – pirmiausia atšaukite vėlesnį pakeitimą." };
  await db.$executeRaw`
    UPDATE "Product" AS p SET "priceCents" = x.p, "salePriceCents" = x.s, "costCents" = x.c, "updatedAt" = NOW()
    FROM jsonb_to_recordset(${row.value}::jsonb) AS x(id text, p int, s int, c int)
    WHERE p.id = x.id`;
  await writeLog(log.map((l) => (l.id === id ? { ...l, undoneAt: new Date().toISOString() } : l)));
  revalidatePath("/", "layout");
  return { ok: `${entry.brand}: kainos grąžintos į buvusias (${entry.count} produktų).` };
}

export async function priceChangeLog(): Promise<PriceChangeLog[]> {
  await requireAdmin();
  return readLog();
}
