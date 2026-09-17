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
    currency: String(formData.get("currency") ?? "EUR"),
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

/**
 * Bulk catalogue upload from CSV.
 * Expected header: name,sku,price,currency,category,description,published
 * Rows are upserted by SKU when present, otherwise by slug(name).
 */
export async function importCatalogueCsv(
  _prev: { message?: string; error?: string } | undefined,
  formData: FormData
): Promise<{ message?: string; error?: string }> {
  await requireUser();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Pasirinkite CSV failą." };
  }
  const text = await file.text();
  const rows = parseCsv(text);
  if (rows.length < 2) return { error: "CSV faile nėra duomenų eilučių." };

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const col = (name: string) => header.indexOf(name);
  if (col("name") === -1) return { error: 'CSV faile privalomas stulpelis "name".' };

  let created = 0;
  let updated = 0;
  const errors: string[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const get = (name: string) => {
      const idx = col(name);
      return idx === -1 ? "" : (row[idx] ?? "").trim();
    };
    const name = get("name");
    if (!name) continue;
    try {
      const sku = get("sku") || null;
      const slug = slugify(name);
      const categoryName = get("category");
      let categoryId: string | null = null;
      if (categoryName) {
        const cat = await db.category.upsert({
          where: { slug: slugify(categoryName) },
          create: { name: categoryName, slug: slugify(categoryName) },
          update: {},
        });
        categoryId = cat.id;
      }
      const data = {
        name,
        description: get("description"),
        priceCents: parsePriceCents(get("price") || "0"),
        currency: get("currency") || "EUR",
        published: ["true", "1", "yes", "taip"].includes(get("published").toLowerCase()),
        categoryId,
      };
      const existing = sku
        ? await db.product.findUnique({ where: { sku } })
        : await db.product.findUnique({ where: { slug } });
      if (existing) {
        await db.product.update({ where: { id: existing.id }, data });
        updated++;
      } else {
        await db.product.create({ data: { ...data, sku, slug } });
        created++;
      }
    } catch (e) {
      errors.push(`Eilutė ${i + 1}: ${e instanceof Error ? e.message : "klaida"}`);
    }
  }

  revalidatePath("/catalogue");
  revalidatePath("/admin/products");
  const summary = `Importuota: ${created} nauji, ${updated} atnaujinti.`;
  return errors.length
    ? { error: `${summary} Klaidos: ${errors.slice(0, 5).join("; ")}` }
    : { message: summary };
}

/** Minimal CSV parser with quoted-field support. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((f) => f !== "")) rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  row.push(field);
  if (row.some((f) => f !== "")) rows.push(row);
  return rows;
}
