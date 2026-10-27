"use server";

import { db, tryDb } from "@/lib/db";
import { groupCards, searchSampleProducts } from "@/lib/products";
import type { ProductCardData } from "@/components/catalogue/ProductCard";

/** Header search: published products whose name, brand, typology or category match the query. */
export async function searchProducts(query: string): Promise<ProductCardData[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const products = await tryDb("searchProducts", () =>
    db.product.findMany({
      where: {
        published: true,
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { sku: { contains: q, mode: "insensitive" } },
          { variantLabel: { contains: q, mode: "insensitive" } },
          { brand: { contains: q, mode: "insensitive" } },
          { typology: { contains: q, mode: "insensitive" } },
          { category: { is: { name: { contains: q, mode: "insensitive" } } } },
        ],
      },
      orderBy: { updatedAt: "desc" },
      take: 60,
      include: { category: true, images: { orderBy: { sort: "asc" }, take: 2 } },
    })
  );
  if (products && products.length > 0) return groupCards(products).slice(0, 12);
  // No real products yet (or DB down): fall back to the placeholder catalogue.
  return searchSampleProducts(q);
}
