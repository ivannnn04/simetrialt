"use server";

import { db } from "@/lib/db";
import { currentCustomer } from "@/lib/customer-auth";

/** Albums as the browser keeps them (see lib/albums-store). */
export type SyncedAlbum = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  items: { product: { id: string; name: string; category: string; brand: string; price: string; salePrice?: string | null; priceCents: number; image: string | null; href: string }; quantity: number; note: string; addedAt: number }[];
};

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
      return [
        // ids come from the browser: only ever touch this customer's own rows
        db.collection.upsert({
          where: { id: a.id },
          update: { name: a.name.slice(0, 120) },
          create: { id: a.id, name: a.name.slice(0, 120), customerId: customer.id, createdAt: new Date(a.createdAt || Date.now()) },
        }),
        db.collectionItem.deleteMany({ where: { collectionId: a.id, collection: { customerId: customer.id } } }),
        db.collectionItem.createMany({
          data: items.map((i) => ({
            collectionId: a.id,
            productId: i.product.id,
            quantity: Math.max(1, Math.min(999, Math.round(i.quantity) || 1)),
            note: String(i.note ?? "").slice(0, 500),
            createdAt: new Date(i.addedAt || Date.now()),
          })),
          skipDuplicates: true,
        }),
      ];
    }),
  ]);
  return { ok: true };
}
