import { db } from "@/lib/db";
import { formatPrice } from "@/lib/slug";
import { splitDescription } from "@/lib/product-page";

/** One product of an inquiry, as the admin shows it (photos, specifications, quantity, note). */
export type LeadProduct = {
  productId: string | null;
  slug: string | null;
  sku: string;
  name: string;
  brand: string;
  category: string;
  typology: string;
  images: string[];
  quantity: number;
  unitCents: number;
  unit: string;
  sum: string;
  note: string;
  description: string;
  details: { title: string; body: string }[];
};

/**
 * The products named in an inquiry. A collection inquiry lists them as
 *   "1. Name (Brand)\n   Kodas: SKU · Kiekis: 2 · Kaina: 895,40 €\n   Pastaba: …"
 * (see sendCollectionEnquiry); a product-page inquiry carries one productSku.
 */
export function parseLeadLines(message: string, productSku: string | null): { sku: string; name: string; quantity: number; note: string }[] {
  const out: { sku: string; name: string; quantity: number; note: string }[] = [];
  const re = /^\d+\.\s+(.+)\n\s+Kodas:\s*(.+?)\s+·\s+Kiekis:\s*(\d+)[^\n]*(?:\n\s+Pastaba:\s*(.+))?/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(message))) out.push({ name: m[1].trim(), sku: m[2].trim() === "—" ? "" : m[2].trim(), quantity: Number(m[3]) || 1, note: (m[4] ?? "").trim() });
  if (!out.length && productSku) out.push({ sku: productSku, name: "", quantity: 1, note: "" });
  return out;
}

export async function loadLeadProducts(message: string, productSku: string | null): Promise<LeadProduct[]> {
  const lines = parseLeadLines(message, productSku);
  if (!lines.length) return [];
  const skus = lines.map((l) => l.sku).filter(Boolean);
  const products = await db.product.findMany({
    where: { sku: { in: skus } },
    include: { category: true, images: { orderBy: { sort: "asc" } } },
  });
  const bySku = new Map(products.map((p) => [p.sku ?? "", p]));
  return lines.map((l) => {
    const p = l.sku ? bySku.get(l.sku) : undefined;
    const unitCents = p ? (p.salePriceCents != null && p.salePriceCents < p.priceCents ? p.salePriceCents : p.priceCents) : 0;
    const currency = p?.currency ?? "EUR";
    const split = p ? splitDescription(p.description ?? "", p.material ?? "") : { description: "", details: [] };
    return {
      productId: p?.id ?? null,
      slug: p?.slug ?? null,
      sku: l.sku,
      name: p?.name ?? l.name,
      brand: p?.brand ?? "",
      category: p?.category?.name ?? "",
      typology: p?.typology ?? "",
      images: p?.images.map((i) => i.url) ?? [],
      quantity: l.quantity,
      unitCents,
      unit: unitCents ? formatPrice(unitCents, currency) : "—",
      sum: unitCents ? formatPrice(unitCents * l.quantity, currency) : "—",
      note: l.note,
      description: split.description,
      details: split.details,
    };
  });
}
