"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { currentOrGuestCustomer } from "@/lib/customer-auth";
import { SAMPLE_CATALOGUE } from "@/data/sample-catalogue";
import { SAMPLE_PRODUCTS } from "@/lib/products";

export type CollectionSummary = { id: string; name: string; count: number; hasProduct: boolean };

/** Collections of the signed-in customer, or null when anonymous (used by the save button). */
export async function getMyCollections(productId?: string): Promise<CollectionSummary[] | null> {
  const customer = await currentOrGuestCustomer();
  if (!customer) return null;
  const collections = await db.collection.findMany({
    where: { customerId: customer.id },
    orderBy: { updatedAt: "desc" },
    include: { items: { select: { productId: true } } },
  });
  return collections.map((c) => ({
    id: c.id,
    name: c.name,
    count: c.items.length,
    hasProduct: productId ? c.items.some((i) => i.productId === productId) : false,
  }));
}

export async function createCollection(_prev: { error?: string } | undefined, formData: FormData) {
  const customer = await currentOrGuestCustomer();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Please name the collection." };
  const collection = await db.collection.create({ data: { name, customerId: customer.id } });
  revalidatePath("/account/albums");
  redirect(`/account/albums/${collection.id}`);
}

export async function renameCollection(id: string, formData: FormData) {
  const customer = await currentOrGuestCustomer();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  await db.collection.updateMany({ where: { id, customerId: customer.id }, data: { name } });
  revalidatePath(`/account/albums/${id}`);
  revalidatePath("/account/albums");
}

export async function deleteCollection(id: string) {
  const customer = await currentOrGuestCustomer();
  await db.collection.deleteMany({ where: { id, customerId: customer.id } });
  revalidatePath("/account/albums");
  redirect("/account/albums");
}

/** Adds a product to a collection; `collectionId === "new"` creates one named `newName`. */
export async function addToCollection(
  productId: string,
  collectionId: string,
  newName?: string
): Promise<{ ok: true; collectionId: string; name: string } | { error: string }> {
  const customer = await currentOrGuestCustomer();
  const product = (await db.product.findUnique({ where: { id: productId }, select: { id: true } })) ?? (await ensureSampleProduct(productId));
  if (!product) return { error: "This product is no longer available." };

  let target = collectionId === "new" ? null : await db.collection.findFirst({ where: { id: collectionId, customerId: customer.id } });
  if (!target) {
    const name = (newName ?? "").trim() || "My collection";
    target = await db.collection.create({ data: { name, customerId: customer.id } });
  }
  await db.collectionItem.upsert({
    where: { collectionId_productId: { collectionId: target.id, productId } },
    create: { collectionId: target.id, productId },
    update: {},
  });
  await db.collection.update({ where: { id: target.id }, data: { updatedAt: new Date() } });
  revalidatePath("/account/albums");
  revalidatePath(`/account/albums/${target.id}`);
  return { ok: true, collectionId: target.id, name: target.name };
}

export async function removeFromCollection(collectionId: string, productId: string) {
  const customer = await currentOrGuestCustomer();
  const owned = await db.collection.findFirst({ where: { id: collectionId, customerId: customer.id } });
  if (!owned) return;
  await db.collectionItem.deleteMany({ where: { collectionId, productId } });
  revalidatePath(`/account/albums/${collectionId}`);
  revalidatePath("/account/albums");
}

/** Album table (Figma 4217:46938): planned quantity and note per saved product. */
export async function updateCollectionItem(
  collectionId: string,
  productId: string,
  patch: { quantity?: number; note?: string }
) {
  const customer = await currentOrGuestCustomer();
  const owned = await db.collection.findFirst({ where: { id: collectionId, customerId: customer.id } });
  if (!owned) return;
  const data: { quantity?: number; note?: string } = {};
  if (patch.quantity != null) data.quantity = Math.max(1, Math.min(999, Math.round(patch.quantity)));
  if (patch.note != null) data.note = patch.note.slice(0, 500);
  await db.collectionItem.updateMany({ where: { collectionId, productId }, data });
  await db.collection.update({ where: { id: collectionId }, data: { updatedAt: new Date() } });
  revalidatePath(`/account/albums/${collectionId}`);
}

/** Product ids saved in any of the signed-in customer's collections (empty when anonymous). */
export async function getSavedProductIds(): Promise<string[]> {
  try {
    const customer = await currentOrGuestCustomer();
    if (!customer) return [];
    const items = await db.collectionItem.findMany({
      where: { collection: { customerId: customer.id } },
      select: { productId: true },
      distinct: ["productId"],
    });
    return items.map((i) => i.productId);
  } catch {
    return [];
  }
}

/**
 * Sample catalogue items are not in the database; saving one creates an unpublished product row
 * with the sample id so it can live in a collection like a real product.
 */
async function ensureSampleProduct(id: string): Promise<{ id: string } | null> {
  const sample = SAMPLE_CATALOGUE.find((p) => p.id === id);
  const card = sample ? null : SAMPLE_PRODUCTS.find((p) => p.id === id);
  if (!sample && !card) return null;
  const categorySlug = sample?.category.slug ?? "lighting";
  const categoryName = sample?.category.name ?? "Lighting";
  const category = await db.category.upsert({ where: { slug: categorySlug }, update: {}, create: { slug: categorySlug, name: categoryName } });
  const priceCents = sample ? sample.priceCents : Math.round(Number(card!.price.replace(/[^0-9.]/g, "")) * 100) || 0;
  const salePriceCents = sample ? sample.salePriceCents ?? null : card!.salePrice ? Math.round(Number(card!.salePrice.replace(/[^0-9.]/g, "")) * 100) : null;
  return db.product.upsert({
    where: { id },
    update: {},
    create: {
      id,
      slug: id,
      name: sample?.name ?? card!.name,
      priceCents,
      salePriceCents,
      brand: sample?.brand ?? "Marset",
      typology: sample?.typology ?? card!.category,
      material: sample?.material ?? null,
      inShowroom: sample?.inShowroom ?? true,
      published: false,
      categoryId: category.id,
    },
    select: { id: true },
  });
}
