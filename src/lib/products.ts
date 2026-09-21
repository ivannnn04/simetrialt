import type { Category, Product, ProductImage } from "@prisma/client";
import { db } from "@/lib/db";
import { formatPrice } from "@/lib/slug";
import type { ProductCardData } from "@/components/catalogue/ProductCard";

export type ProductWithRelations = Product & { category: Category | null; images: ProductImage[] };

export function toCard(p: ProductWithRelations): ProductCardData {
  const onSale = p.salePriceCents != null && p.salePriceCents < p.priceCents;
  return {
    id: p.id,
    name: p.name,
    category: p.category?.name ?? "",
    price: formatPrice(p.priceCents, p.currency),
    salePrice: onSale ? formatPrice(p.salePriceCents!, p.currency) : null,
    discount: onSale && p.priceCents > 0 ? Math.round((1 - p.salePriceCents! / p.priceCents) * 100) : null,
    href: `/catalogue/${p.slug}`,
    image: p.images[0]?.url ?? null,
    hoverImage: p.images[1]?.url ?? null,
  };
}

// Placeholder cards (Figma mock names) shown until the catalogue has enough published products.
export const SAMPLE_PRODUCTS: ProductCardData[] = [
  { id: "sample-1", name: "n35", category: "Lighting", price: "€5,000", href: "/catalogue/sample-1" },
  { id: "sample-2", name: "Okha Repose sofa", category: "Sofas", price: "€5,000", salePrice: "€4,250", discount: 15, href: "/catalogue/sample-2" },
  { id: "sample-3", name: "Okha Repose", category: "Tables", price: "€5,000", href: "/catalogue/sample-3" },
  { id: "sample-4", name: "Clay dining table", category: "Tables", price: "€3,900", href: "/catalogue/sample-4" },
  { id: "sample-5", name: "Halo pendant", category: "Lighting", price: "€1,280", href: "/catalogue/sample-5" },
  { id: "sample-6", name: "Lounge armchair", category: "Seating", price: "€2,150", salePrice: "€1,890", discount: 12, href: "/catalogue/sample-6" },
  { id: "sample-7", name: "Console 02", category: "Storage", price: "€2,700", href: "/catalogue/sample-7" },
  { id: "sample-8", name: "Arc floor lamp", category: "Lighting", price: "€960", href: "/catalogue/sample-8" },
  { id: "sample-9", name: "Modular sofa", category: "Sofas", price: "€7,400", href: "/catalogue/sample-9" },
  { id: "sample-10", name: "Bell table lamp", category: "Lighting", price: "€540", href: "/catalogue/sample-10" },
  { id: "sample-11", name: "Tripod floor lamp", category: "Lighting", price: "€1,150", salePrice: "€980", discount: 15, href: "/catalogue/sample-11" },
  { id: "sample-12", name: "Dome desk lamp", category: "Lighting", price: "€420", href: "/catalogue/sample-12" },
  { id: "sample-13", name: "Ginger wall lamp", category: "Lighting", price: "€690", href: "/catalogue/sample-13" },
  { id: "sample-14", name: "Paper pendant lamp", category: "Lighting", price: "€860", href: "/catalogue/sample-14" },
  { id: "sample-15", name: "Brass reading lamp", category: "Lighting", price: "€1,320", href: "/catalogue/sample-15" },
  { id: "sample-16", name: "Rechargeable lamp", category: "Lighting", price: "€310", href: "/catalogue/sample-16" },
];

/** Latest published products as cards, padded with samples up to `take`; never throws on DB outages. */
export async function getFeaturedProducts(take = 3): Promise<ProductCardData[]> {
  let cards: ProductCardData[] = [];
  try {
    const products = await db.product.findMany({
      where: { published: true },
      orderBy: { updatedAt: "desc" },
      take,
      include: { category: true, images: { orderBy: { sort: "asc" }, take: 2 } },
    });
    cards = products.map(toCard);
  } catch (e) {
    console.error("getFeaturedProducts: database unavailable", e);
  }
  for (let i = 0; cards.length < take && i < SAMPLE_PRODUCTS.length; i++) cards.push(SAMPLE_PRODUCTS[i]);
  return cards;
}

/** Placeholder search over the sample catalogue (used until real products exist). */
export function searchSampleProducts(query: string): ProductCardData[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return SAMPLE_PRODUCTS.filter((p) => `${p.name} ${p.category}`.toLowerCase().includes(q));
}

export function relativeTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d} day${d === 1 ? "" : "s"} ago`;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
