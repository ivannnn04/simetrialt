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
  };
}

// Placeholder cards (Figma mock names) shown until the catalogue has enough published products.
const SAMPLE_PRODUCTS: ProductCardData[] = [
  { id: "sample-1", name: "n35", category: "Lighting", price: "€5,000", href: "/catalogue" },
  { id: "sample-2", name: "Okha Repose sofa", category: "Sofas", price: "€5,000", salePrice: "€4,250", discount: 15, href: "/catalogue" },
  { id: "sample-3", name: "Okha Repose", category: "Tables", price: "€5,000", href: "/catalogue" },
  { id: "sample-4", name: "Clay dining table", category: "Tables", price: "€3,900", href: "/catalogue" },
  { id: "sample-5", name: "Halo pendant", category: "Lighting", price: "€1,280", href: "/catalogue" },
  { id: "sample-6", name: "Lounge armchair", category: "Seating", price: "€2,150", salePrice: "€1,890", discount: 12, href: "/catalogue" },
  { id: "sample-7", name: "Console 02", category: "Storage", price: "€2,700", href: "/catalogue" },
  { id: "sample-8", name: "Arc floor lamp", category: "Lighting", price: "€960", href: "/catalogue" },
  { id: "sample-9", name: "Modular sofa", category: "Sofas", price: "€7,400", href: "/catalogue" },
];

/** Latest published products as cards, padded with samples up to `take`; never throws on DB outages. */
export async function getFeaturedProducts(take = 3): Promise<ProductCardData[]> {
  let cards: ProductCardData[] = [];
  try {
    const products = await db.product.findMany({
      where: { published: true },
      orderBy: { updatedAt: "desc" },
      take,
      include: { category: true, images: { orderBy: { sort: "asc" }, take: 1 } },
    });
    cards = products.map(toCard);
  } catch (e) {
    console.error("getFeaturedProducts: database unavailable", e);
  }
  for (let i = 0; cards.length < take && i < SAMPLE_PRODUCTS.length; i++) cards.push(SAMPLE_PRODUCTS[i]);
  return cards;
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
