"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";

/** Quotes are prepared by showroom managers, editors and administrators alike. */

export type QuoteItemInput = {
  id?: string;
  productId: string | null;
  name: string;
  sku: string;
  image: string;
  unitCents: number;
  quantity: number;
  discountPct: number;
};

export type QuoteInput = {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  company: string;
  note: string;
  discountPct: number;
  status: string;
  validUntil: string;
  items: QuoteItemInput[];
};

const STATUSES = ["DRAFT", "SENT", "ACCEPTED", "DECLINED"];
const clampPct = (n: number) => Math.min(100, Math.max(0, Number.isFinite(n) ? n : 0));

/** A new empty quote; the editor opens right away. */
export async function createQuote(): Promise<void> {
  const me = await requireUser();
  const q = await db.quote.create({ data: { authorId: me.id } });
  redirect(`/admin/quotes/${q.id}`);
}

export async function saveQuote(id: string, input: QuoteInput): Promise<{ ok?: string; error?: string }> {
  await requireUser();
  const quote = await db.quote.findUnique({ where: { id }, select: { id: true } });
  if (!quote) return { error: "Pasiūlymas nerastas." };
  const items = input.items
    .filter((i) => i.name.trim())
    .map((i, n) => ({
      productId: i.productId || null,
      name: i.name.trim().slice(0, 200),
      sku: (i.sku ?? "").trim().slice(0, 80),
      image: (i.image ?? "").slice(0, 500),
      unitCents: Math.max(0, Math.round(Number(i.unitCents) || 0)),
      quantity: Math.max(1, Math.round(Number(i.quantity) || 1)),
      discountPct: clampPct(Number(i.discountPct)),
      sort: n,
    }));
  const validUntil = input.validUntil ? new Date(input.validUntil) : null;
  await db.$transaction([
    db.quoteItem.deleteMany({ where: { quoteId: id } }),
    db.quote.update({
      where: { id },
      data: {
        customerName: input.customerName.trim().slice(0, 200),
        customerEmail: input.customerEmail.trim().toLowerCase().slice(0, 200),
        customerPhone: input.customerPhone.trim().slice(0, 60),
        company: input.company.trim().slice(0, 200),
        note: input.note.slice(0, 4000),
        discountPct: clampPct(Number(input.discountPct)),
        status: STATUSES.includes(input.status) ? input.status : "DRAFT",
        validUntil: validUntil && !Number.isNaN(validUntil.getTime()) ? validUntil : null,
        items: { create: items },
      },
    }),
  ]);
  revalidatePath("/admin/quotes");
  revalidatePath(`/admin/quotes/${id}`);
  return { ok: "Pasiūlymas išsaugotas." };
}

export async function deleteQuote(id: string): Promise<void> {
  await requireUser();
  await db.quote.delete({ where: { id } }).catch(() => undefined);
  revalidatePath("/admin/quotes");
  redirect("/admin/quotes");
}

export type ProductHit = { id: string; name: string; sku: string; brand: string; image: string; unitCents: number; slug: string };

/** Products for the quote editor's search box: by name, code or brand. */
export async function searchProductsForQuote(q: string): Promise<ProductHit[]> {
  await requireUser();
  const term = q.trim();
  if (term.length < 2) return [];
  const rows = await db.product.findMany({
    where: { OR: [{ name: { contains: term, mode: "insensitive" } }, { sku: { contains: term, mode: "insensitive" } }, { brand: { contains: term, mode: "insensitive" } }, { variantLabel: { contains: term, mode: "insensitive" } }] },
    orderBy: { name: "asc" },
    take: 20,
    include: { images: { orderBy: { sort: "asc" }, take: 1 } },
  });
  return rows.map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku ?? "",
    brand: p.brand ?? "",
    image: p.images[0]?.url ?? "",
    unitCents: p.salePriceCents != null && p.salePriceCents < p.priceCents ? p.salePriceCents : p.priceCents,
    slug: p.slug,
  }));
}

/** From a product page: puts the product into the signed-in staff member's open draft (or a new one). */
export async function addProductToMyQuote(productId: string): Promise<{ quoteId?: string; error?: string }> {
  const me = await requireUser();
  const p = await db.product.findUnique({ where: { id: productId }, include: { images: { orderBy: { sort: "asc" }, take: 1 } } });
  if (!p) return { error: "Produktas nerastas." };
  let quote = await db.quote.findFirst({ where: { authorId: me.id, status: "DRAFT" }, orderBy: { updatedAt: "desc" }, include: { items: true } });
  if (!quote) quote = await db.quote.create({ data: { authorId: me.id }, include: { items: true } });
  const existing = quote.items.find((i) => i.productId === p.id);
  if (existing) await db.quoteItem.update({ where: { id: existing.id }, data: { quantity: existing.quantity + 1 } });
  else
    await db.quoteItem.create({
      data: {
        quoteId: quote.id,
        productId: p.id,
        name: p.name,
        sku: p.sku ?? "",
        image: p.images[0]?.url ?? "",
        unitCents: p.salePriceCents != null && p.salePriceCents < p.priceCents ? p.salePriceCents : p.priceCents,
        sort: quote.items.length,
      },
    });
  await db.quote.update({ where: { id: quote.id }, data: { updatedAt: new Date() } });
  revalidatePath(`/admin/quotes/${quote.id}`);
  return { quoteId: quote.id };
}
