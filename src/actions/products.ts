"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireEditor } from "@/lib/auth";
import { slugify } from "@/lib/slug";
import { saveImage } from "@/lib/uploads";
import { storeRemoteImage } from "@/lib/remote-images";
import { Prisma } from "@prisma/client";
import { deriveVariant } from "@/lib/variants";
import { after } from "next/server";
import { kickProductSync, queueDeactivations } from "@/lib/scoro/sync";

function parsePriceCents(raw: string): number {
  const n = Number.parseFloat(raw.replace(",", "."));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

function optionalCents(raw: string): number | null {
  return raw.trim() ? parsePriceCents(raw) : null;
}

const optional = (v: FormDataEntryValue | null | string) => String(v ?? "").trim() || null;

export async function saveProduct(id: string | null, formData: FormData) {
  await requireEditor();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Pavadinimas privalomas");
  const slug = slugify(String(formData.get("slug") ?? "") || name);
  const sku = String(formData.get("sku") ?? "").trim() || null;
  const categoryId = String(formData.get("categoryId") ?? "") || null;

  const data = {
    name,
    slug,
    sku,
    description: String(formData.get("description") ?? ""),
    priceCents: parsePriceCents(String(formData.get("price") ?? "0")),
    salePriceCents: optionalCents(String(formData.get("salePrice") ?? "")),
    currency: String(formData.get("currency") ?? "EUR"),
    brand: optional(formData.get("brand")),
    typology: optional(formData.get("typology")),
    material: optional(formData.get("material")),
    inShowroom: formData.get("inShowroom") === "on",
    inStock: formData.get("inStock") === "on",
    stockQty: (() => {
      const n = Number.parseInt(String(formData.get("stockQty") ?? ""), 10);
      return Number.isFinite(n) && n >= 0 ? n : null;
    })(),
    published: formData.get("published") === "on",
    categoryId,
  };
  // variant group: an explicit key from the form wins, else it is derived from the name
  const derived = deriveVariant({ name, brand: data.brand, typology: data.typology, description: data.description, sku });
  const groupKey = String(formData.get("groupKey") ?? "").trim() || derived.groupKey;
  const variantLabel = String(formData.get("variantLabel") ?? "").trim() || derived.label || null;
  const attrsText = String(formData.get("variantAttrs") ?? "").trim();
  const variantAttrs = attrsText
    ? Object.fromEntries(attrsText.split(/[;\n]+/).map((pair) => pair.split("=").map((x) => x.trim())).filter(([k, v]) => k && v))
    : derived.attrs;
  Object.assign(data, { groupKey, variantLabel, variantAttrs });

  const product = id
    ? await db.product.update({ where: { id }, data })
    : await db.product.create({ data });

  // Attach any newly uploaded images.
  const files = formData
    .getAll("images")
    .filter((f): f is File => f instanceof File && f.size > 0);
  const existing = await db.productImage.count({ where: { productId: product.id } });
  for (const [i, file] of files.entries()) {
    const url = await saveImage(file);
    await db.productImage.create({
      data: { productId: product.id, url, alt: name, sort: existing + i },
    });
  }

  revalidatePath("/catalogue");
  revalidatePath(`/catalogue/${slug}`);
  await kickProductSync(after);
  redirect(`/admin/products/${product.id}`);
}

export async function deleteProduct(id: string) {
  await requireEditor();
  await queueDeactivations({ id });
  await db.product.delete({ where: { id } });
  revalidatePath("/catalogue");
  redirect("/admin/products");
}

export type BulkDeleteResult = { deleted: number; error?: string } | null;

/** Bulk delete from the products table: the selected ids, or every product when `all` is on. */
export async function deleteProducts(_prev: BulkDeleteResult, formData: FormData): Promise<BulkDeleteResult> {
  await requireEditor();
  const all = formData.get("all") === "on";
  const ids = formData.getAll("ids").map(String).filter(Boolean);
  try {
    let deleted = 0;
    await queueDeactivations(all ? {} : { id: { in: ids } });
    if (all) {
      // in batches, so one request never has to remove thousands of rows (and their cascades) at once
      for (;;) {
        const batch = await db.product.findMany({ select: { id: true }, take: 200 });
        if (batch.length === 0) break;
        deleted += (await db.product.deleteMany({ where: { id: { in: batch.map((b) => b.id) } } })).count;
      }
    } else if (ids.length) {
      for (let i = 0; i < ids.length; i += 200) {
        deleted += (await db.product.deleteMany({ where: { id: { in: ids.slice(i, i + 200) } } })).count;
      }
    }
    // categories left without products are removed too, so the list stays tidy after an import test
    await db.category.deleteMany({ where: { products: { none: {} } } });
    revalidatePath("/catalogue");
    revalidatePath("/outlet");
    revalidatePath("/admin/products");
    return { deleted };
  } catch (e) {
    return { deleted: 0, error: e instanceof Error ? e.message.split("\n").filter(Boolean)[0] : "Nepavyko ištrinti." };
  }
}

/** Recomputes the variant group of every product from its name (used once after the variants feature shipped, or after bulk edits). */
export async function regroupProducts(): Promise<{ products: number; groups: number }> {
  await requireEditor();
  const products = await db.product.findMany({ select: { id: true, name: true, brand: true, typology: true, description: true, sku: true } });
  const keys = new Set<string>();
  for (const p of products) {
    const d = deriveVariant(p);
    keys.add(d.groupKey);
    await db.product.update({ where: { id: p.id }, data: { groupKey: d.groupKey, variantAttrs: d.attrs, variantLabel: d.label || null } });
  }
  revalidatePath("/catalogue");
  revalidatePath("/outlet");
  revalidatePath("/admin/products");
  return { products: products.length, groups: keys.size };
}

export async function deleteProductImage(imageId: string, productId: string) {
  await requireEditor();
  await db.productImage.delete({ where: { id: imageId } });
  revalidatePath(`/admin/products/${productId}`);
}

export async function saveCategory(formData: FormData) {
  await requireEditor();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  await db.category.create({ data: { name, slug: slugify(name) } });
  revalidatePath("/admin/products");
  revalidatePath("/catalogue");
}

export async function deleteCategory(id: string) {
  await requireEditor();
  await db.category.delete({ where: { id } });
  revalidatePath("/admin/products");
  revalidatePath("/catalogue");
}

/** "In stock" for one or many products at once (from the products list). */
export async function setProductsInStock(ids: string[], inStock: boolean): Promise<{ updated: number }> {
  await requireEditor();
  const list = ids.filter((id) => typeof id === "string" && id).slice(0, 5000);
  if (!list.length) return { updated: 0 };
  const res = await db.product.updateMany({ where: { id: { in: list } }, data: { inStock } });
  revalidatePath("/admin/products");
  revalidatePath("/", "layout");
  return { updated: res.count };
}

/** Product photos that still point to another website (e.g. a supplier's), as distinct URLs. */
async function externalPhotoUrls(take?: number): Promise<string[]> {
  const rows = await db.$queryRaw<{ url: string }[]>`
    SELECT DISTINCT url FROM "ProductImage"
    WHERE url LIKE 'http%' AND url NOT LIKE '%.blob.vercel-storage.com/%'
    ORDER BY url ${take ? Prisma.sql`LIMIT ${take}` : Prisma.empty}`;
  return rows.map((r) => r.url);
}

export async function countExternalPhotos(): Promise<number> {
  await requireEditor();
  const [{ n }] = await db.$queryRaw<{ n: number }[]>`
    SELECT COUNT(DISTINCT url)::int AS n FROM "ProductImage" WHERE url LIKE 'http%' AND url NOT LIKE '%.blob.vercel-storage.com/%'`;
  return n;
}

/**
 * Copies a batch of external product photos into our own storage and points every product that uses
 * them at the copy. Called repeatedly by the admin button until nothing is left.
 */
export async function storeExternalPhotos(): Promise<{ stored: number; failed: string[]; remaining: number }> {
  await requireEditor();
  const started = Date.now();
  const failed: string[] = [];
  let stored = 0;
  const skip = new Set<string>();
  while (Date.now() - started < 40_000) {
    const batch = (await externalPhotoUrls(12 + skip.size)).filter((u) => !skip.has(u)).slice(0, 6);
    if (!batch.length) break;
    await Promise.all(
      batch.map(async (src) => {
        try {
          const url = await storeRemoteImage(src);
          await db.productImage.updateMany({ where: { url: src }, data: { url } });
          stored++;
        } catch (e) {
          skip.add(src);
          failed.push(`${src}: ${e instanceof Error ? e.message : "klaida"}`);
        }
      })
    );
  }
  const remaining = (await externalPhotoUrls()).filter((u) => !skip.has(u)).length;
  if (stored) {
    revalidatePath("/catalogue");
    revalidatePath("/admin/products");
  }
  return { stored, failed, remaining };
}
