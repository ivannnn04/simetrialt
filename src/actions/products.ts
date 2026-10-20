"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { slugify } from "@/lib/slug";
import { saveImage } from "@/lib/uploads";

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
  await requireUser();
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
  await requireUser();
  await db.product.delete({ where: { id } });
  revalidatePath("/catalogue");
  redirect("/admin/products");
}

export async function deleteProductImage(imageId: string, productId: string) {
  await requireUser();
  await db.productImage.delete({ where: { id: imageId } });
  revalidatePath(`/admin/products/${productId}`);
}

export async function saveCategory(formData: FormData) {
  await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  await db.category.create({ data: { name, slug: slugify(name) } });
  revalidatePath("/admin/products");
  revalidatePath("/catalogue");
}

export async function deleteCategory(id: string) {
  await requireUser();
  await db.category.delete({ where: { id } });
  revalidatePath("/admin/products");
  revalidatePath("/catalogue");
}
