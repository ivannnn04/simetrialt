"use server";

import { revalidatePath } from "next/cache";
import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { slugify } from "@/lib/slug";
import { saveImage } from "@/lib/uploads";
import {
  FIELDS,
  guessMapping,
  imageKeyCandidates,
  parsePriceCents,
  parseSpreadsheet,
  truthy,
  type Field,
} from "@/lib/catalogue-import";

/** Parsed file kept between the two steps of the import wizard (expires after an hour). */
type Staged = { filename: string; sheet?: string; headers: string[]; rows: string[][]; createdAt: number };

const STAGE_TTL_MS = 60 * 60 * 1000;
const stageKey = (token: string) => `import:${token}`;

export type Analysis = {
  token: string;
  filename: string;
  sheet?: string;
  headers: string[];
  guess: (Field | "")[];
  sample: string[][];
  totalRows: number;
  existingBySku: number;
  withoutSku: number;
  error?: string;
};

export type ImportResult = {
  created: number;
  updated: number;
  skipped: number;
  dryRun: boolean;
  errors: string[];
  plan?: { sku: string; name: string; action: "create" | "update" | "skip"; price: string }[];
  error?: string;
};

/** Step 1: parse the uploaded price list, guess the column mapping and stage the rows. */
export async function analyzeImport(_prev: Analysis | null | undefined, formData: FormData): Promise<Analysis | null> {
  await requireUser();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return null;
  const parsed = parseSpreadsheet(await file.arrayBuffer(), file.name);
  if (parsed.headers.length === 0 || parsed.rows.length === 0) {
    return { token: "", filename: file.name, headers: [], guess: [], sample: [], totalRows: 0, existingBySku: 0, withoutSku: 0, error: "Faile nerasta lentelės su antrašte ir bent viena eilute." };
  }
  const guess = guessMapping(parsed.headers);
  const skuCol = guess.indexOf("sku");
  const skus = skuCol >= 0 ? parsed.rows.map((r) => (r[skuCol] ?? "").trim()).filter(Boolean) : [];
  const existing = skus.length ? await db.product.count({ where: { sku: { in: skus } } }) : 0;

  const token = randomBytes(8).toString("hex");
  const staged: Staged = { filename: file.name, sheet: parsed.sheet, headers: parsed.headers, rows: parsed.rows, createdAt: Date.now() };
  await db.setting.upsert({ where: { key: stageKey(token) }, create: { key: stageKey(token), value: JSON.stringify(staged) }, update: { value: JSON.stringify(staged) } });
  // housekeeping: drop stale stages
  const old = await db.setting.findMany({ where: { key: { startsWith: "import:" } } });
  for (const s of old) {
    try {
      if (Date.now() - (JSON.parse(s.value) as Staged).createdAt > STAGE_TTL_MS) await db.setting.delete({ where: { key: s.key } });
    } catch {
      await db.setting.delete({ where: { key: s.key } });
    }
  }

  return {
    token,
    filename: file.name,
    sheet: parsed.sheet,
    headers: parsed.headers,
    guess,
    sample: parsed.rows.slice(0, 5),
    totalRows: parsed.rows.length,
    existingBySku: existing,
    withoutSku: parsed.rows.length - skus.length,
  };
}

/** Step 2: apply the mapping to the staged rows; with `dryRun` nothing is written. */
export async function runImport(_prev: ImportResult | null | undefined, formData: FormData): Promise<ImportResult | null> {
  await requireUser();
  const token = String(formData.get("token") ?? "");
  const row = await db.setting.findUnique({ where: { key: stageKey(token) } });
  if (!row) return { created: 0, updated: 0, skipped: 0, dryRun: false, errors: [], error: "Įkelto failo nebėra (praėjo daugiau nei valanda). Įkelkite iš naujo." };
  const staged = JSON.parse(row.value) as Staged;

  const mapping = staged.headers.map((_, i) => {
    const v = String(formData.get(`col:${i}`) ?? "");
    return (FIELDS as readonly string[]).includes(v) ? (v as Field) : "";
  });
  const col = (f: Field) => mapping.indexOf(f);
  if (col("name") < 0 && col("sku") < 0) {
    return { created: 0, updated: 0, skipped: 0, dryRun: false, errors: [], error: "Pažymėkite bent stulpelį „Pavadinimas“ arba „SKU“." };
  }

  const dryRun = formData.get("dryRun") === "on";
  const defaultBrand = String(formData.get("defaultBrand") ?? "").trim();
  const defaultCategory = String(formData.get("defaultCategory") ?? "").trim();
  const multiplier = Number.parseFloat(String(formData.get("multiplier") ?? "1").replace(",", ".")) || 1;
  const publish = formData.get("publish") === "on";
  const onlyUpdate = formData.get("onlyUpdate") === "on";
  const updateExisting = formData.get("updateExisting") !== "off";

  const categoryCache = new Map<string, string>();
  const categoryId = async (name: string) => {
    if (!name) return null;
    const slug = slugify(name);
    if (categoryCache.has(slug)) return categoryCache.get(slug)!;
    const cat = dryRun
      ? await db.category.findUnique({ where: { slug } })
      : await db.category.upsert({ where: { slug }, create: { name, slug }, update: {} });
    const id = cat?.id ?? "";
    categoryCache.set(slug, id);
    return id || null;
  };

  const result: ImportResult = { created: 0, updated: 0, skipped: 0, dryRun, errors: [], plan: [] };
  const get = (r: string[], f: Field) => {
    const i = col(f);
    return i < 0 ? "" : (r[i] ?? "").trim();
  };

  for (const [index, r] of staged.rows.entries()) {
    const sku = get(r, "sku") || null;
    const existing = sku ? await db.product.findUnique({ where: { sku } }) : await db.product.findFirst({ where: { slug: slugify(get(r, "name")) } });
    // name: the mapped column, else the first line of the description, else keep the stored one, else the SKU
    const givenName = get(r, "name") || get(r, "description").split(/\r?\n/)[0].slice(0, 120).trim();
    const name = givenName || existing?.name || sku || "";
    if (!name) {
      result.skipped++;
      continue;
    }
    try {
      const priceRaw = parsePriceCents(get(r, "price"));
      const saleRaw = parsePriceCents(get(r, "sale_price"));
      const priceCents = priceRaw == null ? undefined : Math.round(priceRaw * multiplier);
      const salePriceCents = saleRaw == null ? undefined : Math.round(saleRaw * multiplier);
      // defaults only fill gaps: they never overwrite a brand / category an existing product already has
      const brandName = get(r, "brand") || (existing?.brand ? "" : defaultBrand);
      const catName = get(r, "category") || (existing?.categoryId ? "" : defaultCategory);
      const data: Record<string, unknown> = {
        ...(givenName ? { name } : {}),
        ...(priceCents !== undefined ? { priceCents } : {}),
        ...(col("sale_price") >= 0 ? { salePriceCents: salePriceCents ?? null } : {}),
        ...(get(r, "currency") ? { currency: get(r, "currency").toUpperCase().slice(0, 3) } : {}),
        ...(brandName ? { brand: brandName } : {}),
        ...(get(r, "typology") ? { typology: get(r, "typology") } : {}),
        ...(get(r, "material") ? { material: get(r, "material") } : {}),
        ...(get(r, "description") || get(r, "colour")
          ? { description: [get(r, "description"), get(r, "colour") && `Colour: ${get(r, "colour")}`].filter(Boolean).join("\n\n") }
          : {}),
        ...(col("in_showroom") >= 0 ? { inShowroom: truthy(get(r, "in_showroom")) } : {}),
        ...(col("published") >= 0 ? { published: truthy(get(r, "published")) } : publish ? { published: true } : {}),
        ...(catName ? { categoryId: await categoryId(catName) } : {}),
      };

      const priceLabel = priceCents !== undefined ? (priceCents / 100).toFixed(2) : "—";
      if (existing) {
        if (!updateExisting) {
          result.skipped++;
          result.plan!.push({ sku: sku ?? "", name, action: "skip", price: priceLabel });
          continue;
        }
        if (!dryRun) await db.product.update({ where: { id: existing.id }, data });
        result.updated++;
        result.plan!.push({ sku: sku ?? "", name, action: "update", price: priceLabel });
      } else {
        if (onlyUpdate) {
          result.skipped++;
          result.plan!.push({ sku: sku ?? "", name, action: "skip", price: priceLabel });
          continue;
        }
        if (!dryRun) {
          // slug must be unique: suffix with the sku when a product with the same name exists
          let slug = slugify(name);
          if (await db.product.findUnique({ where: { slug } })) slug = slugify(`${name}-${sku ?? index}`);
          await db.product.create({
            data: { ...(data as object), name, sku, slug, priceCents: priceCents ?? 0, published: Boolean(data.published) } as Parameters<typeof db.product.create>[0]["data"],
          });
        }
        result.created++;
        result.plan!.push({ sku: sku ?? "", name, action: "create", price: priceLabel });
      }

      // optional image by URL (only on real runs, only when the product has no image yet)
      const imageUrl = get(r, "image_url");
      if (!dryRun && imageUrl && /^https?:\/\//.test(imageUrl)) {
        const product = sku ? await db.product.findUnique({ where: { sku } }) : await db.product.findFirst({ where: { name } });
        if (product && (await db.productImage.count({ where: { productId: product.id } })) === 0) {
          await db.productImage.create({ data: { productId: product.id, url: imageUrl, alt: name, sort: 0 } });
        }
      }
    } catch (e) {
      result.errors.push(`Eilutė ${index + 2}: ${e instanceof Error ? e.message.split("\n").filter(Boolean)[0] : "klaida"}`);
    }
  }

  if (!dryRun) {
    await db.setting.delete({ where: { key: stageKey(token) } }).catch(() => undefined);
    revalidatePath("/catalogue");
    revalidatePath("/outlet");
    revalidatePath("/admin/products");
  }
  result.plan = result.plan!.slice(0, 200);
  return result;
}

export type ImagesResult = { attached: number; unmatched: string[]; error?: string };

/** Bulk photo upload: each file is attached to the product whose SKU (or slug) its name starts with. */
export async function importImages(_prev: ImagesResult | null | undefined, formData: FormData): Promise<ImagesResult | null> {
  await requireUser();
  const files = formData.getAll("images").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return { attached: 0, unmatched: [], error: "Pasirinkite bent vieną nuotrauką." };
  const replace = formData.get("replace") === "on";

  const result: ImagesResult = { attached: 0, unmatched: [] };
  const cleared = new Set<string>();
  for (const file of files) {
    let product = null;
    for (const key of imageKeyCandidates(file.name)) {
      product =
        (await db.product.findFirst({ where: { sku: { equals: key, mode: "insensitive" } } })) ??
        (await db.product.findFirst({ where: { slug: slugify(key) } }));
      if (product) break;
    }
    if (!product) {
      result.unmatched.push(file.name);
      continue;
    }
    try {
      if (replace && !cleared.has(product.id)) {
        await db.productImage.deleteMany({ where: { productId: product.id } });
        cleared.add(product.id);
      }
      const url = await saveImage(file);
      const sort = await db.productImage.count({ where: { productId: product.id } });
      await db.productImage.create({ data: { productId: product.id, url, alt: product.name, sort } });
      result.attached++;
    } catch (e) {
      result.unmatched.push(`${file.name} (${e instanceof Error ? e.message : "klaida"})`);
    }
  }
  revalidatePath("/catalogue");
  revalidatePath("/admin/products");
  return result;
}
