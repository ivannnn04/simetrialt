import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import { Suspense } from "react";
import { db } from "@/lib/db";
import { toCard } from "@/lib/products";
import { cn } from "@/lib/cn";
import { SiteHeader } from "@/components/site/Header";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { ProductCard } from "@/components/catalogue/ProductCard";
import { Filters, SortSelect, type FilterGroup } from "@/components/catalogue/Filters";

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

// Figma "Furniture Products" (node 4217:47838)
export default async function CataloguePage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const category = list(sp.category);
  const typology = list(sp.typology);
  const brand = list(sp.brand);
  const material = list(sp.material);
  const display = list(sp.display);
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

  const [products, categories, typologies, brands, materials] = await Promise.all([
    db.product.findMany({ where, orderBy: SORTS[sort], include: { category: true, images: { orderBy: { sort: "asc" }, take: 1 } } }),
    db.category.findMany({ orderBy: { sort: "asc" }, where: { products: { some: { published: true } } } }),
    db.product.findMany({ where: { published: true, typology: { not: null } }, distinct: ["typology"], select: { typology: true } }),
    db.product.findMany({ where: { published: true, brand: { not: null } }, distinct: ["brand"], select: { brand: true } }),
    db.product.findMany({ where: { published: true, material: { not: null } }, distinct: ["material"], select: { material: true } }),
  ]);

  const groups: FilterGroup[] = [
    { key: "category", label: "Category", options: categories.map((c) => ({ value: c.slug, label: c.name })) },
    { key: "typology", label: "Typology", options: typologies.map((t) => t.typology!).filter(Boolean) },
    { key: "brand", label: "Brands", options: brands.map((b) => b.brand!).filter(Boolean) },
    { key: "display", label: "On display", options: ["In showroom", "Online only"] },
    { key: "material", label: "Material", options: materials.map((m) => m.material!).filter(Boolean) },
  ].filter((g) => g.options.length > 0);
  // Show category names rather than slugs while keeping slugs as values.
  const categoryLabel = new Map(categories.map((c) => [c.slug, c.name]));
  const activeCategory = category.length === 1 ? categoryLabel.get(category[0]) : undefined;
  const cards = products.map(toCard);

  // Rows alternate between three square cards and two wide cards (Figma grid).
  const rows: typeof cards[] = [];
  for (let i = 0, wide = false; i < cards.length; wide = !wide) {
    const n = wide ? 2 : 3;
    rows.push(cards.slice(i, i + n));
    i += n;
  }

  return (
    <div className="flex w-full flex-col gap-[120px] bg-cream">
      <div className="flex w-full flex-col gap-10">
        <section className="flex w-full flex-col">
          <SiteHeader variant="solid" />
          <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-[35px] px-4 py-[50px] md:px-10">
            <Breadcrumbs
              items={[
                { label: "Home", href: "/" },
                { label: "Products", href: "/catalogue" },
                ...(activeCategory ? [{ label: activeCategory }] : []),
              ]}
            />
            <h1 className="text-[56px] font-medium leading-[0.92] tracking-[-0.04em] text-black md:text-[80px] xl:text-[106px]">
              {activeCategory ?? "All products"}
            </h1>
          </div>
        </section>

        <section className="mx-auto flex w-full max-w-[1440px] flex-col gap-[45px] px-4 md:px-10">
          <div className="flex flex-col gap-2">
            <div className="flex h-5 items-center justify-between">
              <p className="text-[18px] font-semibold uppercase text-[#1a1c18]">Filters</p>
              <Suspense>
                <SortSelect value={sort} />
              </Suspense>
            </div>
            <hr className="border-line" />
          </div>

          <div className="flex flex-col gap-12 lg:flex-row lg:items-start">
            <Suspense>
              <Filters groups={groups} />
            </Suspense>
            <div className="flex flex-1 flex-col gap-4 lg:gap-[60px]">
              {rows.map((row, i) => (
                <div key={i} className={cn("grid gap-4", row.length === 2 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1 md:grid-cols-3")}>
                  {row.map((p) => (
                    <ProductCard key={p.id} product={p} className={row.length === 2 ? "h-[420px] lg:h-[655px]" : "h-[420px] lg:h-[500px]"} />
                  ))}
                </div>
              ))}
              {cards.length === 0 && <p className="text-secondary">No products match these filters.</p>}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
