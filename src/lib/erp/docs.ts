import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { DEFAULT_COMMISSION_PCT, DOC, defaultStatus, statusDef, WAREHOUSES, type DocType } from "./config";
import { docTotals, eur, lineNet } from "./money";

/** Server-side ERP logic: numbering, conversions along the order flow, stock, payments, commissions. */

export type LineInput = {
  productId?: string | null;
  code?: string;
  name: string;
  description?: string;
  qty: number;
  unit?: string;
  priceCents: number;
  discountPct?: number;
  vatPct?: number;
  supplierId?: string | null;
  costCents?: number;
  image?: string;
  sourceLineId?: string | null;
  /** purchase orders: quantity already received (kept when the document is edited) */
  receivedQty?: number;
};

const yy = (d = new Date()) => String(d.getFullYear()).slice(2);

/** Next number in a series: "SDO26-0001". Counters can be set to continue from Scoro's last numbers. */
export async function nextNumber(type: DocType, date = new Date(), tx: Prisma.TransactionClient = db): Promise<{ number: string; series: string }> {
  const series = `${DOC[type].series}${yy(date)}`;
  const c = await tx.erpCounter.upsert({ where: { series }, update: { last: { increment: 1 } }, create: { series, last: 1 } });
  return { number: `${series}-${String(c.last).padStart(4, "0")}`, series };
}

export async function ensureWarehouses() {
  for (const [code, name] of WAREHOUSES) await db.erpWarehouse.upsert({ where: { code }, update: {}, create: { code, name } });
}

const lineData = (l: LineInput, sort: number) => ({
  productId: l.productId || null,
  code: (l.code ?? "").slice(0, 80),
  name: (l.name || "Pozicija").slice(0, 300),
  description: (l.description ?? "").slice(0, 2000),
  qty: Number.isFinite(l.qty) ? l.qty : 1,
  unit: l.unit || "vnt.",
  priceCents: Math.round(l.priceCents || 0),
  discountPct: Math.min(100, Math.max(0, l.discountPct ?? 0)),
  vatPct: l.vatPct ?? 21,
  supplierId: l.supplierId || null,
  costCents: Math.max(0, Math.round(l.costCents ?? 0)),
  image: l.image ?? "",
  sourceLineId: l.sourceLineId ?? null,
  receivedQty: Math.max(0, l.receivedQty ?? 0),
  sort,
});

export async function logEvent(documentId: string, text: string, userName = "", kind: "LOG" | "COMMENT" = "LOG") {
  await db.erpEvent.create({ data: { documentId, text: text.slice(0, 2000), userName, kind } });
}

export async function createDocument(
  type: DocType,
  data: Omit<Prisma.ErpDocumentUncheckedCreateInput, "type" | "number" | "series" | "status"> & { status?: string },
  lines: LineInput[],
  userName = ""
) {
  const date = data.date ? new Date(data.date as Date) : new Date();
  const doc = await db.$transaction(async (tx) => {
    const { number, series } = await nextNumber(type, date, tx);
    return tx.erpDocument.create({
      data: {
        ...data,
        type,
        number,
        series,
        status: data.status ?? defaultStatus(type),
        probability: type === "OFFER" ? (data.probability ?? statusDef(type, data.status ?? defaultStatus(type)).probability ?? null) : null,
        lines: { create: lines.map(lineData) },
      },
    });
  });
  await logEvent(doc.id, `Sukurta: ${DOC[type].label} ${doc.number}`, userName);
  return doc;
}

export async function replaceLines(documentId: string, lines: LineInput[]) {
  await db.$transaction([db.erpLine.deleteMany({ where: { documentId } }), db.erpLine.createMany({ data: lines.map((l, i) => ({ ...lineData(l, i), documentId })) })]);
}

export const totalsOf = (d: { lines: { qty: number; priceCents: number; discountPct: number; vatPct: number; costCents: number }[]; discountPct: number }) =>
  docTotals(d.lines, d.discountPct);

const docWithLines = (id: string) => db.erpDocument.findUniqueOrThrow({ where: { id }, include: { lines: { orderBy: { sort: "asc" } }, payments: true, children: { include: { lines: true } } } });

const copyLine = (l: Prisma.ErpLineGetPayload<object>): LineInput => ({
  productId: l.productId,
  code: l.code,
  name: l.name,
  description: l.description,
  qty: l.qty,
  unit: l.unit,
  priceCents: l.priceCents,
  discountPct: l.discountPct,
  vatPct: l.vatPct,
  supplierId: l.supplierId,
  costCents: l.costCents,
  image: l.image,
  sourceLineId: l.id,
  receivedQty: 0,
});

const headerFrom = (d: Prisma.ErpDocumentGetPayload<object>) => ({
  clientId: d.clientId,
  partyId: d.partyId,
  channel: d.channel,
  managerId: d.managerId,
  discountPct: d.discountPct,
  isDemo: d.isDemo,
});

/** Offer → order (status of the offer becomes "Užsakytas"). */
export async function offerToOrder(offerId: string, userName = "", at = new Date()) {
  const offer = await docWithLines(offerId);
  const order = await createDocument(
    "ORDER",
    { ...headerFrom(offer), date: at, parentId: offer.id, advancePct: 30, deliveryTerm: "6–8 savaitės", note: offer.note },
    offer.lines.map(copyLine),
    userName
  );
  await db.erpDocument.update({ where: { id: offer.id }, data: { status: "Užsakytas", probability: 100 } });
  await logEvent(offer.id, `Sukurtas užsakymas ${order.number}; būsena → Užsakytas`, userName);
  return order;
}

/** Order → prepayment invoice for the contract advance %. */
export async function orderToPrepayment(orderId: string, userName = "", at = new Date()) {
  const order = await docWithLines(orderId);
  const net = docTotals(order.lines, order.discountPct).net;
  const pctAdv = order.advancePct || 30;
  const inv = await createDocument(
    "PREPAYMENT",
    { ...headerFrom(order), discountPct: 0, date: at, parentId: order.id, dueDate: new Date(at.getTime() + 7 * 864e5) },
    [{ name: `Avansas ${pctAdv}% pagal užsakymą ${order.number}`, qty: 1, priceCents: Math.round((net * pctAdv) / 100), vatPct: 21 }],
    userName
  );
  await logEvent(order.id, `Išrašyta išankstinė sąskaita ${inv.number} (${pctAdv}%)`, userName);
  return inv;
}

/** Order → final invoice; paid prepayments of the order are deducted. */
export async function orderToInvoice(orderId: string, userName = "", at = new Date()) {
  const order = await docWithLines(orderId);
  const prepayments = order.children.filter((c) => c.type === "PREPAYMENT" && c.status !== "Anuliuota");
  const lines: LineInput[] = order.lines.map(copyLine);
  for (const p of prepayments) {
    const t = docTotals(p.lines, p.discountPct);
    lines.push({ name: `Išankstinis apmokėjimas pagal ${p.number}`, qty: 1, priceCents: -t.net, vatPct: 21 });
  }
  const inv = await createDocument("INVOICE", { ...headerFrom(order), date: at, parentId: order.id, dueDate: new Date(at.getTime() + 14 * 864e5) }, lines, userName);
  await db.erpDocument.update({ where: { id: order.id }, data: { status: "Išrašyta sąskaita" } });
  await logEvent(order.id, `Išrašyta sąskaita ${inv.number}; būsena → Išrašyta sąskaita`, userName);
  return inv;
}

/** Order → one purchase order per supplier (lines at purchase cost). */
export async function orderToPurchaseOrders(orderId: string, userName = "", at = new Date()) {
  const order = await docWithLines(orderId);
  const already = new Set(order.children.filter((c) => c.type === "PURCHASE_ORDER").flatMap((c) => c.lines.map((l) => l.sourceLineId)));
  const bySupplier = new Map<string, typeof order.lines>();
  for (const l of order.lines) {
    if (already.has(l.id) || l.priceCents < 0) continue;
    const key = l.supplierId ?? "";
    bySupplier.set(key, [...(bySupplier.get(key) ?? []), l]);
  }
  const created = [];
  for (const [supplierId, lines] of bySupplier) {
    const po = await createDocument(
      "PURCHASE_ORDER",
      { supplierId: supplierId || null, managerId: order.managerId, date: at, parentId: order.id, isDemo: order.isDemo, note: `Kliento užsakymas ${order.number}` },
      lines.map((l) => ({ ...copyLine(l), priceCents: l.costCents, discountPct: 0, costCents: l.costCents })),
      userName
    );
    created.push(po);
  }
  if (created.length) {
    await db.erpDocument.update({ where: { id: order.id }, data: { status: "Pirkimas/gamyba" } });
    await logEvent(order.id, `Sukurti pirkimo užsakymai: ${created.map((c) => c.number).join(", ")}; būsena → Pirkimas/gamyba`, userName);
  }
  return created;
}

/** Receives (part of) a purchase order into a warehouse; order status follows when everything arrived. */
export async function receivePurchaseOrder(poId: string, warehouseId: string, quantities: Record<string, number>, userName = "") {
  const po = await docWithLines(poId);
  let received = 0;
  for (const l of po.lines) {
    const q = Math.max(0, Math.min(quantities[l.id] ?? 0, l.qty - l.receivedQty));
    if (!q) continue;
    received += q;
    await db.erpLine.update({ where: { id: l.id }, data: { receivedQty: { increment: q } } });
    if (l.productId) {
      const s = await db.erpStock.findUnique({ where: { productId_warehouseId: { productId: l.productId, warehouseId } } });
      const qty = (s?.qty ?? 0) + q;
      const avg = Math.round(((s?.qty ?? 0) * (s?.costCents ?? 0) + q * l.priceCents) / qty);
      await db.erpStock.upsert({
        where: { productId_warehouseId: { productId: l.productId, warehouseId } },
        update: { qty, costCents: avg, reserved: { increment: po.parentId ? q : 0 } },
        create: { productId: l.productId, warehouseId, qty, costCents: avg, reserved: po.parentId ? q : 0 },
      });
      await db.erpStockMove.create({ data: { productId: l.productId, warehouseId, type: "RECEIPT", qty: q, costCents: l.priceCents, documentId: po.id, note: po.number } });
    }
  }
  if (!received) return { received: 0 };
  const fresh = await docWithLines(poId);
  const complete = fresh.lines.every((l) => l.receivedQty >= l.qty);
  await db.erpDocument.update({ where: { id: po.id }, data: { status: complete ? "Gautas" : "Dalinai gautas" } });
  await logEvent(po.id, `Gauta ${received} vnt.; būsena → ${complete ? "Gautas" : "Dalinai gautas"}`, userName);
  if (po.parentId) {
    const siblings = await db.erpDocument.findMany({ where: { parentId: po.parentId, type: "PURCHASE_ORDER", deleted: false }, include: { lines: true } });
    const all = siblings.every((s) => s.lines.every((l) => l.receivedQty >= l.qty));
    const order = await db.erpDocument.findUnique({ where: { id: po.parentId } });
    if (order && !["Išrašyta sąskaita", "Užbaigtas / atiduotas", "Atsiskaityta architektui"].includes(order.status)) {
      const status = all ? "Prekės sandėlyje" : "Kelyje užs. dalis";
      await db.erpDocument.update({ where: { id: order.id }, data: { status } });
      await logEvent(order.id, `Prekės gautos (${po.number}); būsena → ${status}`, userName);
    }
  }
  return { received, complete };
}

/** Moves stock between warehouses, issues it to a client or writes it off. */
export async function moveStock(input: { productId: string; warehouseId: string; type: "TRANSFER" | "ISSUE" | "WRITEOFF"; qty: number; toWarehouseId?: string; note?: string }) {
  const s = await db.erpStock.findUnique({ where: { productId_warehouseId: { productId: input.productId, warehouseId: input.warehouseId } } });
  if (!s || s.qty < input.qty) throw new Error("Nepakanka likučio sandėlyje");
  await db.erpStock.update({ where: { id: s.id }, data: { qty: { decrement: input.qty }, reserved: Math.max(0, s.reserved - (input.type === "ISSUE" ? input.qty : 0)) } });
  if (input.type === "TRANSFER" && input.toWarehouseId) {
    await db.erpStock.upsert({
      where: { productId_warehouseId: { productId: input.productId, warehouseId: input.toWarehouseId } },
      update: { qty: { increment: input.qty } },
      create: { productId: input.productId, warehouseId: input.toWarehouseId, qty: input.qty, costCents: s.costCents },
    });
  }
  await db.erpStockMove.create({ data: { ...input, costCents: s.costCents, note: input.note ?? "" } });
}

/** Paid / partly paid / overdue from payments and the due date. */
export async function refreshPaymentStatus(documentId: string, userName = "") {
  const d = await db.erpDocument.findUniqueOrThrow({ where: { id: documentId }, include: { lines: true, payments: true } });
  if (!["INVOICE", "PREPAYMENT", "PURCHASE_INVOICE"].includes(d.type) || d.status === "Anuliuota") return d.status;
  const total = docTotals(d.lines, d.discountPct).total;
  const paid = d.payments.reduce((n, p) => n + p.amountCents, 0);
  const overdue = d.dueDate && d.dueDate.getTime() < Date.now() - 864e5;
  const status = paid >= total && total > 0 ? "Apmokėta" : paid > 0 ? (d.type === "PURCHASE_INVOICE" ? "Neapmokėta" : "Dalinai apmokėta") : overdue ? "Vėluoja" : "Neapmokėta";
  if (status !== d.status) {
    await db.erpDocument.update({ where: { id: d.id }, data: { status } });
    await logEvent(d.id, `Būsena → ${status}`, userName);
  }
  if (status === "Apmokėta" && d.type === "INVOICE") await accrueCommission(d.id);
  return status;
}

export async function addPayment(documentId: string, amountCents: number, method: string, date: Date, note = "", userName = "") {
  await db.erpPayment.create({ data: { documentId, amountCents, method, date, note } });
  await logEvent(documentId, `Gautas mokėjimas ${eur(amountCents)} (${method})`, userName);
  return refreshPaymentStatus(documentId, userName);
}

/** Commission for the architect / partner of a paid invoice: % of the net sale (excl. deducted prepayment lines). */
export async function accrueCommission(invoiceId: string) {
  const inv = await db.erpDocument.findUniqueOrThrow({ where: { id: invoiceId }, include: { lines: true, party: true, parent: { include: { children: { include: { lines: true } } } } } });
  if (!inv.party) return null;
  // the sale = the order's goods; prepayment deductions are not a discount
  const base = inv.lines.filter((l) => l.priceCents > 0).reduce((n, l) => n + lineNet(l), 0);
  const p = inv.party.commissionPct ?? DEFAULT_COMMISSION_PCT;
  return db.erpCommission.upsert({
    where: { documentId_architectId: { documentId: inv.id, architectId: inv.party.id } },
    update: {},
    create: { architectId: inv.party.id, documentId: inv.id, baseCents: base, pct: p, amountCents: Math.round((base * p) / 100) },
  });
}

/** Overdue invoices are recognised on every list load. */
export async function markOverdue() {
  const due = await db.erpDocument.findMany({
    where: { type: { in: ["INVOICE", "PREPAYMENT", "PURCHASE_INVOICE"] }, status: { in: ["Neapmokėta"] }, dueDate: { lt: new Date(Date.now() - 864e5) }, deleted: false },
    select: { id: true },
  });
  for (const d of due) await db.erpDocument.update({ where: { id: d.id }, data: { status: "Vėluoja" } });
}
