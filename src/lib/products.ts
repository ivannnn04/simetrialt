import { db } from "@/lib/db";
import { formatPrice } from "@/lib/slug";
import type { ProductCardData } from "@/components/home/HomeSections";

// Placeholder cards from the Figma mock, used until the catalogue has three published products.
const SAMPLE_PRODUCTS: ProductCardData[] = [
  { name: "n35", category: "Lighting", price: "$5,000", href: "/catalogue" },
  { name: "Okha Repose sofa", category: "Sofas", price: "$5,000", href: "/catalogue" },
  { name: "Okha Repose", category: "Tables", price: "$5,000", href: "/catalogue" },
];

/** Latest published products as cards, padded with samples; never throws on DB outages. */
export async function getFeaturedProducts(take = 3): Promise<ProductCardData[]> {
  let cards: ProductCardData[] = [];
  try {
    const products = await db.product.findMany({
      where: { published: true },
      orderBy: { updatedAt: "desc" },
      take,
      include: { category: true, images: { orderBy: { sort: "asc" }, take: 1 } },
    });
    cards = products.map((p) => ({
      name: p.name,
      category: p.category?.name ?? "",
      price: formatPrice(p.priceCents, p.currency),
      href: `/catalogue/${p.slug}`,
      image: p.images[0]?.url ?? null,
    }));
  } catch (e) {
    console.error("getFeaturedProducts: database unavailable", e);
  }
  while (cards.length < take) cards.push(SAMPLE_PRODUCTS[cards.length % SAMPLE_PRODUCTS.length]);
  return cards;
}
