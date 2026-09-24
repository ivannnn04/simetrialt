import type { Prisma } from "@prisma/client";
import { db, tryDb } from "@/lib/db";
import { toCard } from "@/lib/products";
import type { FilterGroup } from "@/components/catalogue/Filters";
import type { ProductCardData } from "@/components/catalogue/ProductCard";
import { filterSamples, sampleCategoryName, sampleGroups, sampleToCard } from "@/data/sample-catalogue";

export type Search = Record<string, string | string[] | undefined>;
const list = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? [v] : []);

export const SORTS: Record<string, Prisma.ProductOrderByWithRelationInput> = {
  relevance: { updatedAt: "desc" },
  newest: { createdAt: "desc" },
  "price-asc": { priceCents: "asc" },
  "price-desc": { priceCents: "desc" },
  name: { name: "asc" },
};

export type CatalogueResult = {
  groups: FilterGroup[];
  cards: ProductCardData[];
  sort: string;
  category: string[];
  activeCategory?: string;
  activeTypology?: string;
  page: number;
  pages: number;
  total: number;
};

/**
 * Reads the filter / sort / page search params and loads one page of products, either from the
 * database or (while it has no published products) from the static sample catalogue.
 */
export async function loadCatalogue(sp: Search, opts: { saleOnly?: boolean; perPage?: number } = {}): Promise<CatalogueResult> {
  const perPage = opts.perPage ?? 8; // 3 + 2 + 3 cards per page (Figma outlet grid)
  const category = list(sp.category);
  const typology = list(sp.typology);
  const brand = list(sp.brand);
  const material = list(sp.material);
  const display = list(sp.display);
  const features = list(sp.features);
  const min = Number(sp.min) || undefined;
  const max = Number(sp.max) || undefined;
  const sort = typeof sp.sort === "string" && sp.sort in SORTS ? sp.sort : "relevance";
  const page = Math.max(1, Number(sp.page) || 1);

  const scope: Prisma.ProductWhereInput = {
    published: true,
    ...(opts.saleOnly ? { salePriceCents: { not: null } } : {}),
    ...(category.length ? { category: { slug: { in: category } } } : {}),
  };
  const where: Prisma.ProductWhereInput = {
    ...scope,
    ...(typology.length ? { typology: { in: typology } } : {}),
    ...(brand.length ? { brand: { in: brand } } : {}),
    ...(material.length ? { material: { in: material } } : {}),
    ...(display.length === 1 ? { inShowroom: display[0] === "In showroom" } : {}),
    ...(min || max ? { priceCents: { ...(min ? { gte: min * 100 } : {}), ...(max ? { lte: max * 100 } : {}) } } : {}),
  };

  const hasProducts = ((await tryDb("catalogue", () => db.product.count({ where: { published: true } }))) ?? 0) > 0;

  let groups: FilterGroup[] = [];
  let cards: ProductCardData[] = [];
  let total = 0;
  let activeCategory: string | undefined;

  if (hasProducts) {
    const [products, count, categories, typologies, brands, materials] = await Promise.all([
      db.product.findMany({
        where,
        orderBy: SORTS[sort],
        skip: (page - 1) * perPage,
        take: perPage,
        include: { category: true, images: { orderBy: { sort: "asc" }, take: 2 } },
      }),
      db.product.count({ where }),
      db.category.findMany({ orderBy: { sort: "asc" }, where: { products: { some: { published: true } } } }),
      db.product.findMany({ where: { ...scope, typology: { not: null } }, distinct: ["typology"], select: { typology: true } }),
      db.product.findMany({ where: { ...scope, brand: { not: null } }, distinct: ["brand"], select: { brand: true } }),
      db.product.findMany({ where: { ...scope, material: { not: null } }, distinct: ["material"], select: { material: true } }),
    ]);
    groups = [
      { key: "typology", label: "Typology", options: typologies.map((t) => t.typology!).filter(Boolean) },
      { key: "brand", label: "Brands", options: brands.map((b) => b.brand!).filter(Boolean) },
      { key: "display", label: "On display", options: ["In showroom", "Online only"] },
      { key: "material", label: "Material", options: materials.map((m) => m.material!).filter(Boolean) },
    ].filter((g) => g.options.length > 0);
    const categoryLabel = new Map(categories.map((c) => [c.slug, c.name]));
    activeCategory = category.length === 1 ? categoryLabel.get(category[0]) : undefined;
    cards = products.map(toCard);
    total = count;
  } else {
    // No published products yet: static catalogue so the filters, grid and pagination can be exercised.
    groups = sampleGroups(category, opts.saleOnly);
    activeCategory = category.length === 1 ? sampleCategoryName(category[0]) : undefined;
    const all = filterSamples({ category, typology, brand, material, display, features, min, max, sort, saleOnly: opts.saleOnly });
    total = all.length;
    cards = all.slice((page - 1) * perPage, page * perPage).map(sampleToCard);
  }

  return {
    groups,
    cards,
    sort,
    category,
    activeCategory,
    activeTypology: typology.length === 1 ? typology[0] : undefined,
    page,
    pages: Math.max(1, Math.ceil(total / perPage)),
    total,
  };
}
