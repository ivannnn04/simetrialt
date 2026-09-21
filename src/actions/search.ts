"use server";

import { db } from "@/lib/db";
import { toCard, searchSampleProducts } from "@/lib/products";
import type { ProductCardData } from "@/components/catalogue/ProductCard";

/** Header search: published products whose name, brand, typology or category match the query. */
export async function searchProducts(query: string): Promise<ProductCardData[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  try {
    const products = await db.product.findMany({
      where: {
        published: true,
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { brand: { contains: q, mode: "insensitive" } },
          { typology: { contains: q, mode: "insensitive" } },
          { category: { is: { name: { contains: q, mode: "insensitive" } } } },
        ],
      },
      orderBy: { updatedAt: "desc" },
      take: 12,
      include: { category: true, images: { orderBy: { sort: "asc" }, take: 1 } },
    });
    if (products.length > 0) return products.map(toCard);
  } catch (e) {
    console.error("searchProducts: database unavailable", e);
  }
  // No real products yet (or DB down): fall back to the placeholder catalogue.
  return searchSampleProducts(q);
}
