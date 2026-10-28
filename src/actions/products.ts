"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireEditor } from "@/lib/auth";
import { slugify } from "@/lib/slug";
import { saveImage } from "@/lib/uploads";
import { deriveVariant } from "@/lib/variants";

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
  redirect(`/admin/products/${product.id}`);
}

export async function deleteProduct(id: string) {
  await requireEditor();
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
