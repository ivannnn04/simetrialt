import type { Metadata } from "next";
import { SiteHeader } from "@/components/site/Header";
import { CatalogueGrid } from "@/components/catalogue/CatalogueGrid";
import { Pagination } from "@/components/catalogue/Pagination";
import { loadCatalogue, type Search } from "@/lib/catalogue";
import { pageHref } from "@/lib/page-href";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Outlet — Simetria LT",
  description: "Past-season pieces and showroom samples from the brands we represent — same products, same quality, exceptional pricing.",
};

// Figma "Outlet" (node 4217:46833): hero, filters bar, 3 / 2 / 3 grid, pagination
export default async function OutletPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const { groups, cards, sort, page, pages } = await loadCatalogue(sp, { saleOnly: true });

  return (
    <div className="flex w-full flex-col bg-cream pb-10 md:pb-[120px]">
      <div className="flex w-full flex-col gap-10">
        <section className="flex w-full flex-col">
          <SiteHeader variant="solid" />
          <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-10 px-4 py-[50px] md:px-10 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-col gap-[35px] font-medium text-black">
              <p className="text-[13px] uppercase leading-[1.5]">Outlet</p>
              <h1 className="max-w-[1016px] text-[56px] leading-[0.92] tracking-[-0.04em] md:text-[80px] xl:text-[106px]">
                Considered savings, same standards
              </h1>
            </div>
            <p className="text-[16px] leading-[1.3] tracking-[-0.04em] text-[#2b2b2b] lg:w-[315px] lg:shrink-0">
              Past-season pieces and showroom samples from the brands we represent — same products, same quality,
              exceptional pricing.
            </p>
          </div>
        </section>

        <CatalogueGrid groups={groups} cards={cards} sort={sort} basePath="/outlet" />
        <Pagination page={page} pages={pages} href={(n) => pageHref("/outlet", sp, n)} />
      </div>
    </div>
  );
}
