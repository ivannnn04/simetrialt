import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { PATH_TYPES, STATUSES, type DocType } from "./config";
import { docTotals } from "./money";
import { markOverdue } from "./docs";

export type ListFilters = { q?: string; status?: string | string[]; manager?: string; from?: string; to?: string; type?: string; party?: string };

export function listWhere(kind: string, f: ListFilters): Prisma.ErpDocumentWhereInput {
  const types = (PATH_TYPES[kind] ?? []) as DocType[];
  const statuses = (Array.isArray(f.status) ? f.status : f.status ? [f.status] : []).filter(Boolean);
  const q = f.q?.trim();
  return {
    type: f.type && types.includes(f.type as DocType) ? f.type : { in: types },
    deleted: false,
    ...(statuses.length ? { status: { in: statuses } } : {}),
    ...(f.manager ? { managerId: f.manager } : {}),
    ...(f.party ? { partyId: f.party } : {}),
    ...(f.from || f.to ? { date: { ...(f.from ? { gte: new Date(f.from) } : {}), ...(f.to ? { lte: new Date(`${f.to}T23:59:59`) } : {}) } } : {}),
    ...(q
      ? {
          OR: [
            { number: { contains: q, mode: "insensitive" } },
            { client: { name: { contains: q, mode: "insensitive" } } },
            { supplier: { name: { contains: q, mode: "insensitive" } } },
            { party: { name: { contains: q, mode: "insensitive" } } },
            { lines: { some: { OR: [{ name: { contains: q, mode: "insensitive" } }, { code: { contains: q, mode: "insensitive" } }] } } },
          ],
        }
      : {}),
  };
}

export async function listDocuments(kind: string, f: ListFilters, take = 300) {
  if (kind === "invoices" || kind === "purchase-invoices") await markOverdue();
  const where = listWhere(kind, f);
  const docs = await db.erpDocument.findMany({
    where,
    orderBy: [{ date: "desc" }, { number: "desc" }],
    take,
    include: { lines: true, payments: true, client: { select: { id: true, name: true } }, supplier: { select: { id: true, name: true } }, party: { select: { id: true, name: true } } },
  });
  const statusCounts = await db.erpDocument.groupBy({ by: ["status"], where: { ...where, status: undefined }, _count: true });
  return {
    docs: docs.map((d) => {
      const t = docTotals(d.lines, d.discountPct);
      const paid = d.payments.reduce((n, p) => n + p.amountCents, 0);
      return { ...d, t, paid, open: Math.max(0, t.total - paid) };
    }),
    statusCounts: Object.fromEntries(statusCounts.map((s) => [s.status, s._count])) as Record<string, number>,
    statuses: [...new Map(((PATH_TYPES[kind] ?? []) as DocType[]).flatMap((t) => STATUSES[t]).map((s) => [s.key, s])).values()],
  };
}

export async function userNames(): Promise<Record<string, string>> {
  const users = await db.user.findMany({ select: { id: true, name: true } });
  return Object.fromEntries(users.map((u) => [u.id, u.name]));
}

/**
 * Revenue documents in a period: invoices + prepayment invoices + credit notes. Final invoices deduct
 * their prepayments, so adding prepayment invoices counts every sale exactly once.
 */
export async function revenueDocs(from: Date, to: Date) {
  const docs = await db.erpDocument.findMany({
    where: { type: { in: ["INVOICE", "PREPAYMENT", "CREDIT"] }, deleted: false, status: { not: "Anuliuota" }, date: { gte: from, lt: to } },
    include: { lines: true, payments: true, client: { select: { id: true, name: true } } },
  });
  return docs.map((d) => ({ ...d, t: docTotals(d.lines, d.discountPct), paid: d.payments.reduce((n, p) => n + p.amountCents, 0) }));
}

export const sumNet = (docs: { t: { net: number } }[]) => docs.reduce((n, d) => n + d.t.net, 0);
