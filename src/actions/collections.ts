"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { currentCustomer, requireCustomer } from "@/lib/customer-auth";

export type CollectionSummary = { id: string; name: string; count: number; hasProduct: boolean };

/** Collections of the signed-in customer, or null when anonymous (used by the save button). */
export async function getMyCollections(productId?: string): Promise<CollectionSummary[] | null> {
  const customer = await currentCustomer();
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
  const customer = await requireCustomer();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Please name the collection." };
  const collection = await db.collection.create({ data: { name, customerId: customer.id } });
  revalidatePath("/account/albums");
  redirect(`/account/albums/${collection.id}`);
}

export async function renameCollection(id: string, formData: FormData) {
  const customer = await requireCustomer();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  await db.collection.updateMany({ where: { id, customerId: customer.id }, data: { name } });
  revalidatePath(`/account/albums/${id}`);
  revalidatePath("/account/albums");
}

export async function deleteCollection(id: string) {
  const customer = await requireCustomer();
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
  const customer = await currentCustomer();
  if (!customer) return { error: "Please sign in to save products." };
  const product = await db.product.findUnique({ where: { id: productId }, select: { id: true } });
  if (!product) return { error: "This is a sample product — real catalogue items can be saved." };

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
  const customer = await requireCustomer();
  const owned = await db.collection.findFirst({ where: { id: collectionId, customerId: customer.id } });
  if (!owned) return;
  await db.collectionItem.deleteMany({ where: { collectionId, productId } });
  revalidatePath(`/account/albums/${collectionId}`);
  revalidatePath("/account/albums");
}
