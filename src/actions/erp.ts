"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin, requireEditor } from "@/lib/auth";
import { DOC, defaultStatus, statusDef, type DocType } from "@/lib/erp/config";
import {
  addPayment,
  createDocument,
  ensureWarehouses,
  logEvent,
  moveStock,
  offerToOrder,
  orderToInvoice,
  orderToPrepayment,
  orderToPurchaseOrders,
  receivePurchaseOrder,
  refreshPaymentStatus,
  replaceLines,
  type LineInput,
} from "@/lib/erp/docs";
import { createDemoData, deleteDemoData } from "@/lib/erp/demo";

const docUrl = (type: string, id: string) => `/admin/erp/${DOC[type as DocType].path}/${id}`;
const refresh = () => revalidatePath("/admin/erp", "layout");

export type DocInput = {
  date: string;
  dueDate: string;
  validUntil: string;
  status: string;
  clientId: string;
  partyId: string;
  supplierId: string;
  channel: string;
  managerId: string;
  probability: number | null;
  discountPct: number;
  advancePct: number;
  deliveryTerm: string;
  contractText: string;
  note: string;
  lines: LineInput[];
};

const dt = (s: string) => (s ? new Date(s) : null);

export async function saveErpDocument(id: string | null, type: DocType, input: DocInput): Promise<{ id?: string; error?: string }> {
  const me = await requireEditor();
  const header = {
    date: dt(input.date) ?? new Date(),
    dueDate: dt(input.dueDate),
    validUntil: dt(input.validUntil),
    clientId: input.clientId || null,
    partyId: input.partyId || null,
    supplierId: input.supplierId || null,
    channel: input.channel || "Be architekto",
    managerId: input.managerId || null,
    discountPct: Math.min(100, Math.max(0, Number(input.discountPct) || 0)),
    advancePct: Math.min(100, Math.max(0, Number(input.advancePct) || 0)),
    deliveryTerm: input.deliveryTerm ?? "",
    contractText: input.contractText ?? "",
    note: input.note ?? "",
  };
  const lines = input.lines.filter((l) => l.name.trim());
  if (!id) {
    const doc = await createDocument(type, { ...header, status: input.status || defaultStatus(type), probability: input.probability }, lines, me.name);
    refresh();
    return { id: doc.id };
  }
  const before = await db.erpDocument.findUnique({ where: { id } });
  if (!before) return { error: "Dokumentas nerastas" };
  const status = input.status || before.status;
  await db.erpDocument.update({
    where: { id },
    data: { ...header, status, probability: type === "OFFER" ? (input.probability ?? statusDef(type, status).probability ?? null) : null },
  });
  await replaceLines(id, lines);
  await logEvent(id, status !== before.status ? `Išsaugota; būsena ${before.status} → ${status}` : "Išsaugota", me.name);
  if (["INVOICE", "PREPAYMENT", "PURCHASE_INVOICE"].includes(type)) await refreshPaymentStatus(id, me.name);
  refresh();
  return { id };
}

export async function setErpStatus(id: string, status: string) {
  const me = await requireEditor();
  const d = await db.erpDocument.update({ where: { id }, data: { status } });
  if (d.type === "OFFER") await db.erpDocument.update({ where: { id }, data: { probability: statusDef("OFFER", status).probability ?? d.probability } });
  await logEvent(id, `Būsena → ${status}`, me.name);
  refresh();
}

export async function erpConvert(id: string, action: "order" | "prepayment" | "invoice" | "purchase-orders" | "copy" | "credit"): Promise<void> {
  const me = await requireEditor();
  let target: { id: string; type: string } | undefined;
  if (action === "order") target = await offerToOrder(id, me.name);
  else if (action === "prepayment") target = await orderToPrepayment(id, me.name);
  else if (action === "invoice") target = await orderToInvoice(id, me.name);
  else if (action === "purchase-orders") {
    const pos = await orderToPurchaseOrders(id, me.name);
    refresh();
    redirect(pos.length === 1 ? docUrl("PURCHASE_ORDER", pos[0].id) : docUrl("ORDER", id));
  } else {
    const src = await db.erpDocument.findUniqueOrThrow({ where: { id }, include: { lines: { orderBy: { sort: "asc" } } } });
    const type = (action === "credit" ? "CREDIT" : src.type) as DocType;
    target = await createDocument(
      type,
      { clientId: src.clientId, partyId: src.partyId, supplierId: src.supplierId, channel: src.channel, managerId: src.managerId, discountPct: src.discountPct, parentId: action === "credit" ? src.id : src.parentId, note: src.note },
      src.lines.map((l) => ({ ...l, priceCents: action === "credit" ? -l.priceCents : l.priceCents })),
      me.name
    );
  }
  refresh();
  if (target) redirect(docUrl(target.type, target.id));
}

export async function erpReceive(poId: string, formData: FormData) {
  const me = await requireEditor();
  const warehouseId = String(formData.get("warehouseId") ?? "");
  const q: Record<string, number> = {};
  for (const [k, v] of formData.entries()) if (k.startsWith("q_")) q[k.slice(2)] = Number(v) || 0;
  await receivePurchaseOrder(poId, warehouseId, q, me.name);
  refresh();
}

export async function erpPayment(id: string, formData: FormData) {
  const me = await requireEditor();
  const amount = Math.round((Number(String(formData.get("amount") ?? "0").replace(",", ".")) || 0) * 100);
  if (!amount) return;
  await addPayment(id, amount, String(formData.get("method") ?? "Pavedimas"), dt(String(formData.get("date") ?? "")) ?? new Date(), String(formData.get("note") ?? ""), me.name);
  refresh();
}

export async function erpComment(id: string, formData: FormData) {
  const me = await requireEditor();
  const text = String(formData.get("text") ?? "").trim();
  if (text) await logEvent(id, text, me.name, "COMMENT");
  refresh();
}

export async function erpDelete(id: string) {
  const me = await requireEditor();
  const d = await db.erpDocument.update({ where: { id }, data: { deleted: true } });
  await logEvent(id, "Dokumentas pašalintas (archyvuotas)", me.name);
  refresh();
  redirect(`/admin/erp/${DOC[d.type as DocType].path}`);
}

export type ProductOption = { id: string; name: string; code: string; brand: string; image: string; priceCents: number; costCents: number; supplierId: string | null };

/** Catalogue search for document lines: net price, purchase cost and the brand's supplier. */
export async function erpSearchProducts(q: string): Promise<ProductOption[]> {
  await requireEditor();
  const term = q.trim();
  if (term.length < 2) return [];
  const rows = await db.product.findMany({
    where: { OR: [{ name: { contains: term, mode: "insensitive" } }, { sku: { contains: term, mode: "insensitive" } }, { brand: { contains: term, mode: "insensitive" } }] },
    include: { images: { orderBy: { sort: "asc" }, take: 1 } },
    take: 20,
    orderBy: { name: "asc" },
  });
  const brands = [...new Set(rows.map((r) => r.supplierName || r.brand).filter(Boolean))] as string[];
  const suppliers = await db.erpContact.findMany({ where: { category: "Tiekėjas", deleted: false, name: { in: brands, mode: "insensitive" } }, select: { id: true, name: true } });
  return rows.map((p) => {
    const net = Math.round(p.priceCents / 1.21);
    const sup = suppliers.find((s) => s.name.toLowerCase() === (p.supplierName || p.brand || "").toLowerCase());
    return { id: p.id, name: p.name, code: p.sku ?? "", brand: p.brand ?? "", image: p.images[0]?.url ?? "", priceCents: net, costCents: p.costCents ?? Math.round(net * 0.55), supplierId: sup?.id ?? null };
  });
}

// ---------- contacts ----------
export async function saveErpContact(id: string | null, formData: FormData) {
  await requireEditor();
  const s = (k: string) => String(formData.get(k) ?? "").trim();
  const data = {
    kind: s("kind") === "PERSON" ? "PERSON" : "COMPANY",
    name: s("name") || "Be pavadinimo",
    companyId: s("companyId") || null,
    position: s("position"),
    regCode: s("regCode"),
    vatCode: s("vatCode"),
    email: s("email"),
    phone: s("phone"),
    website: s("website"),
    address: s("address"),
    deliveryAddress: s("deliveryAddress"),
    category: s("category") || "Klientas",
    tags: formData.getAll("tags").map(String).filter(Boolean),
    commissionPct: s("commissionPct") ? Number(s("commissionPct").replace(",", ".")) : null,
    managerId: s("managerId") || null,
    notes: s("notes"),
  };
  const c = id ? await db.erpContact.update({ where: { id }, data }) : await db.erpContact.create({ data });
  refresh();
  redirect(`/admin/erp/contacts/${c.id}?saved=1`);
}

export async function deleteErpContact(id: string) {
  await requireEditor();
  await db.erpContact.update({ where: { id }, data: { deleted: true } });
  refresh();
  redirect("/admin/erp/contacts");
}

// ---------- stock ----------
export async function erpStockMove(formData: FormData): Promise<void> {
  await requireEditor();
  const s = (k: string) => String(formData.get(k) ?? "");
  const type = s("type") as "TRANSFER" | "ISSUE" | "WRITEOFF";
  try {
    await moveStock({ productId: s("productId"), warehouseId: s("warehouseId"), toWarehouseId: s("toWarehouseId") || undefined, type, qty: Number(s("qty")) || 0, note: s("note") });
  } catch (e) {
    redirect(`/admin/erp/stock?error=${encodeURIComponent(e instanceof Error ? e.message : "Klaida")}`);
  }
  refresh();
  redirect("/admin/erp/stock?moved=1");
}

// ---------- commissions ----------
export async function setCommissionStatus(id: string, status: "ACCRUED" | "APPROVED" | "PAID") {
  await requireEditor();
  const c = await db.erpCommission.update({ where: { id }, data: { status, paidAt: status === "PAID" ? new Date() : null, method: status === "PAID" ? "Pavedimas" : "" } });
  if (status === "PAID") {
    const inv = await db.erpDocument.findUnique({ where: { id: c.documentId } });
    if (inv?.parentId) await db.erpDocument.update({ where: { id: inv.parentId }, data: { status: "Atsiskaityta architektui" } });
  }
  refresh();
}

// ---------- calendar ----------
export async function saveErpActivity(formData: FormData) {
  const me = await requireEditor();
  const s = (k: string) => String(formData.get(k) ?? "").trim();
  const start = new Date(`${s("date")}T${s("time") || "09:00"}`);
  await db.erpActivity.create({
    data: {
      title: s("title") || s("type"),
      type: s("type"),
      start,
      end: new Date(start.getTime() + (Number(s("minutes")) || 60) * 60e3),
      contactId: s("contactId") || null,
      documentId: s("documentId") || null,
      location: s("location"),
      description: s("description"),
      userIds: [s("userId") || me.id],
    },
  });
  refresh();
}

export async function toggleErpActivity(id: string) {
  await requireEditor();
  const a = await db.erpActivity.findUniqueOrThrow({ where: { id } });
  await db.erpActivity.update({ where: { id }, data: { done: !a.done } });
  refresh();
}

// ---------- demo data ----------
export async function erpCreateDemo(): Promise<void> {
  await requireAdmin();
  await ensureWarehouses();
  const users = await db.user.findMany({ where: { role: { in: ["ADMIN", "EDITOR"] } }, select: { id: true } });
  const msg = await createDemoData(users.map((u) => u.id));
  refresh();
  redirect(`/admin/erp/settings?msg=${encodeURIComponent(msg)}`);
}

export async function erpDeleteDemo(): Promise<void> {
  await requireAdmin();
  const msg = await deleteDemoData();
  refresh();
  redirect(`/admin/erp/settings?msg=${encodeURIComponent(msg)}`);
}

export async function erpSetCounter(formData: FormData): Promise<void> {
  await requireAdmin();
  const series = String(formData.get("series") ?? "").trim().toUpperCase();
  const last = Math.max(0, Number(formData.get("last")) || 0);
  if (series) await db.erpCounter.upsert({ where: { series }, update: { last }, create: { series, last } });
  refresh();
  redirect("/admin/erp/settings?msg=" + encodeURIComponent(`Serija ${series}: kitas numeris ${last + 1}`));
}

export async function setErpStatusForm(id: string, formData: FormData) {
  const status = String(formData.get("status") ?? "");
  if (status) await setErpStatus(id, status);
}
