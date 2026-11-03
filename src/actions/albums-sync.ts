"use server";

import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { currentCustomer } from "@/lib/customer-auth";

/** Albums as the browser keeps them (see lib/albums-store). */
export type SyncedAlbum = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  items: {
    product: { id: string; name: string; category: string; brand: string; price: string; salePrice?: string | null; priceCents: number; image: string | null; href: string };
    quantity: number;
    note: string;
    addedAt: number;
    sectionId?: string;
  }[];
  /** general notes about the project (missing in albums saved before sections existed) */
  note?: string;
  sections?: SyncedSection[];
};

export type SyncedSection = { id: string; name: string; note: string; sort: number };

/** Sections as stored in Collection.sections: only well-formed entries, in order, size-limited. */
function cleanSections(value: unknown): SyncedSection[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value
    .filter((s): s is SyncedSection => !!s && typeof s === "object" && typeof s.id === "string" && /^[A-Za-z0-9_-]{1,40}$/.test(s.id) && typeof s.name === "string")
    .filter((s) => (seen.has(s.id) ? false : (seen.add(s.id), true)))
    .slice(0, 50)
    .map((s, i) => ({ s, i, sort: Number.isFinite(s.sort) ? Number(s.sort) : i }))
    .sort((a, b) => a.sort - b.sort || a.i - b.i)
    .map(({ s }, i) => ({ id: s.id, name: s.name.slice(0, 120), note: typeof s.note === "string" ? s.note.slice(0, 5000) : "", sort: i }));
}

const euro = (cents: number) => `€${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** The signed-in customer's albums from the database, in the browser's format; null when signed out. */
export async function loadMyAlbums(): Promise<SyncedAlbum[] | null> {
  const customer = await currentCustomer();
  if (!customer) return null;
  const rows = await db.collection.findMany({
    where: { customerId: customer.id },
    orderBy: { updatedAt: "desc" },
    include: {
      items: {
        orderBy: { createdAt: "desc" },
        include: { product: { include: { images: { orderBy: { sort: "asc" }, take: 1 }, category: true } } },
      },
    },
  });
  return rows.map((c) => ({
    id: c.id,
    name: c.name,
    createdAt: c.createdAt.getTime(),
    updatedAt: c.updatedAt.getTime(),
    note: c.note,
    sections: cleanSections(c.sections),
    items: c.items.map((i) => {
      const p = i.product;
      const sale = p.salePriceCents != null && p.salePriceCents < p.priceCents ? p.salePriceCents : null;
      return {
        product: {
          id: p.id,
          name: p.name,
          category: p.category?.name ?? p.typology ?? "",
          brand: p.brand ?? "",
          price: euro(p.priceCents),
          salePrice: sale != null ? euro(sale) : null,
          priceCents: sale ?? p.priceCents,
          image: p.images[0]?.url ?? null,
          href: `/catalogue/${p.slug}`,
        },
        quantity: i.quantity,
        note: i.note,
        addedAt: i.createdAt.getTime(),
        ...(i.sectionId ? { sectionId: i.sectionId } : {}),
      };
    }),
  }));
}

/**
 * Stores the browser's albums in the signed-in customer's account: albums and items are created,
 * updated or removed so the database matches. Products that are not in the catalogue database
 * (sample cards) are skipped.
 */
export async function saveMyAlbums(albums: SyncedAlbum[]): Promise<{ ok: boolean }> {
  const customer = await currentCustomer();
  if (!customer) return { ok: false };
  const requested = albums.slice(0, 200).filter((a) => typeof a.id === "string" && /^[A-Za-z0-9_-]{6,40}$/.test(a.id));
  // an id that already belongs to another customer is never touched
  const foreign = new Set(
    (await db.collection.findMany({ where: { id: { in: requested.map((a) => a.id) }, customerId: { not: customer.id } }, select: { id: true } })).map((c) => c.id)
  );
  const list = requested.filter((a) => !foreign.has(a.id));
  const productIds = [...new Set(list.flatMap((a) => a.items.map((i) => i.product.id)))];
  const known = new Set((await db.product.findMany({ where: { id: { in: productIds } }, select: { id: true } })).map((p) => p.id));
  const mine = await db.collection.findMany({ where: { customerId: customer.id }, select: { id: true } });
  const keep = new Set(list.map((a) => a.id));
  await db.$transaction([
    db.collection.deleteMany({ where: { customerId: customer.id, id: { in: mine.map((m) => m.id).filter((id) => !keep.has(id)) } } }),
    ...list.flatMap((a) => {
      const items = a.items.filter((i) => known.has(i.product.id));
      const sections = cleanSections(a.sections);
      const sectionIds = new Set(sections.map((s) => s.id));
      const note = typeof a.note === "string" ? a.note.slice(0, 5000) : "";
      const json = sections as unknown as Prisma.InputJsonValue;
      return [
        // ids come from the browser: only ever touch this customer's own rows
        db.collection.upsert({
          where: { id: a.id },
          update: { name: a.name.slice(0, 120), note, sections: json },
          create: { id: a.id, name: a.name.slice(0, 120), note, sections: json, customerId: customer.id, createdAt: new Date(a.createdAt || Date.now()) },
        }),
        db.collectionItem.deleteMany({ where: { collectionId: a.id, collection: { customerId: customer.id } } }),
        db.collectionItem.createMany({
          data: items.map((i) => ({
            collectionId: a.id,
            productId: i.product.id,
            quantity: Math.max(1, Math.min(999, Math.round(i.quantity) || 1)),
            note: String(i.note ?? "").slice(0, 500),
            sectionId: typeof i.sectionId === "string" && sectionIds.has(i.sectionId) ? i.sectionId : null,
            createdAt: new Date(i.addedAt || Date.now()),
          })),
          skipDuplicates: true,
        }),
      ];
    }),
  ]);
  return { ok: true };
}
