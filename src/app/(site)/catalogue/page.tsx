import type { Metadata } from "next";
import { SiteHeader } from "@/components/site/Header";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { CatalogueGrid } from "@/components/catalogue/CatalogueGrid";
import { Pagination } from "@/components/catalogue/Pagination";
import { loadCatalogue, type Search } from "@/lib/catalogue";
import { pageHref } from "@/lib/page-href";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Products — Simetria LT" };

// Figma "Furniture Products" (node 4217:47838) / "filter-v2" closed state (node 4217:46770)
export default async function CataloguePage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const { groups, cards, sort, category, activeCategory, activeTypology, page, pages } = await loadCatalogue(sp);

  // A single typology from the Products menu becomes the page title (Figma: "Sofas" under Products › Furniture).
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
        <Pagination page={page} pages={pages} href={(n) => pageHref("/catalogue", sp, n)} />
      </div>
    </div>
  );
}
