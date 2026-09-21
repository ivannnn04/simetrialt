import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { toCard } from "@/lib/products";
import { SiteHeader } from "@/components/site/Header";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { CatalogueGrid } from "@/components/catalogue/CatalogueGrid";
import type { FilterGroup } from "@/components/catalogue/Filters";
import type { ProductCardData } from "@/components/catalogue/ProductCard";
import { filterSamples, sampleCategoryName, sampleGroups, sampleToCard } from "@/data/sample-catalogue";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Products — Simetria LT" };

type Search = Record<string, string | string[] | undefined>;
const list = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? [v] : []);

const SORTS: Record<string, Prisma.ProductOrderByWithRelationInput> = {
  relevance: { updatedAt: "desc" },
  newest: { createdAt: "desc" },
  "price-asc": { priceCents: "asc" },
  "price-desc": { priceCents: "desc" },
  name: { name: "asc" },
};

// Figma "Furniture Products" (node 4217:47838) / "filter-v2" closed state (node 4217:46770)
export default async function CataloguePage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const category = list(sp.category);
  const typology = list(sp.typology);
  const brand = list(sp.brand);
  const material = list(sp.material);
  const display = list(sp.display);
  const features = list(sp.features);
  const min = Number(sp.min) || undefined;
  const max = Number(sp.max) || undefined;
  const sort = typeof sp.sort === "string" && sp.sort in SORTS ? sp.sort : "relevance";

  const where: Prisma.ProductWhereInput = {
    published: true,
    ...(category.length ? { category: { slug: { in: category } } } : {}),
    ...(typology.length ? { typology: { in: typology } } : {}),
    ...(brand.length ? { brand: { in: brand } } : {}),
    ...(material.length ? { material: { in: material } } : {}),
    ...(display.length === 1 ? { inShowroom: display[0] === "In showroom" } : {}),
    ...(min || max ? { priceCents: { ...(min ? { gte: min * 100 } : {}), ...(max ? { lte: max * 100 } : {}) } } : {}),
  };

  let groups: FilterGroup[] = [];
  let cards: ProductCardData[] = [];
  let activeCategory: string | undefined;

  let hasProducts = false;
  try {
    hasProducts = (await db.product.count({ where: { published: true } })) > 0;
  } catch (e) {
    console.error("catalogue: database unavailable", e);
  }

  // Filter options are scoped to the selected category (the menu links land on one).
  const scope: Prisma.ProductWhereInput = {
    published: true,
    ...(category.length ? { category: { slug: { in: category } } } : {}),
  };

  if (hasProducts) {
    const [products, categories, typologies, brands, materials] = await Promise.all([
      db.product.findMany({ where, orderBy: SORTS[sort], include: { category: true, images: { orderBy: { sort: "asc" }, take: 2 } } }),
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
  } else {
    // No published products yet: static catalogue so the filters and grid can be exercised.
    groups = sampleGroups(category);
    activeCategory = category.length === 1 ? sampleCategoryName(category[0]) : undefined;
    cards = filterSamples({ category, typology, brand, material, display, features, min, max, sort }).map(sampleToCard);
  }

  // A single typology from the Products menu becomes the page title (Figma: "Sofas" under Products › Furniture).
  const activeTypology = typology.length === 1 ? typology[0] : undefined;
  const title = activeTypology ?? activeCategory ?? "All products";
  const crumbs = [
    { label: "Home", href: "/" },
    { label: "Products", href: "/catalogue" },
    ...(activeCategory
      ? [{ label: activeCategory, href: activeTypology ? `/catalogue?category=${encodeURIComponent(category[0])}` : undefined }]
      : []),
    ...(activeTypology ? [{ label: activeTypology }] : []),
  ];

  return (
    <div className="flex w-full flex-col bg-cream pb-[120px]">
      <div className="flex w-full flex-col gap-10">
        <section className="flex w-full flex-col">
          <SiteHeader variant="solid" />
          <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-[35px] px-4 py-[50px] md:px-10">
            <Breadcrumbs items={crumbs} />
            <h1 className="text-[56px] font-medium leading-[0.92] tracking-[-0.04em] text-black md:text-[80px] xl:text-[106px]">
              {title}
            </h1>
          </div>
        </section>

        <CatalogueGrid groups={groups} cards={cards} sort={sort} />
      </div>
    </div>
  );
}
