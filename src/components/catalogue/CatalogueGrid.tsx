"use client";

import { Suspense, useState } from "react";
import { cn } from "@/lib/cn";
import { CaretIcon } from "@/components/ui/Icons";
import { ProductCard, type ProductCardData } from "@/components/catalogue/ProductCard";
import { Filters, SortSelect, type FilterGroup } from "@/components/catalogue/Filters";

type Props = {
  groups: FilterGroup[];
  cards: ProductCardData[];
  sort: string;
  /** Sidebar visible on first render (Figma "filter-v2" opens with the filters closed). */
  defaultOpen?: boolean;
  /** Route the filters and sort write their params to (catalogue or outlet). */
  basePath?: string;
};

/**
 * Figma "Furniture Products" (4217:47838, filters open) / "filter-v2" (4217:46770, closed):
 * FILTERS toggle + sort on one line, a collapsible 302px sidebar and a grid that alternates rows
 * of three square and two wide cards (348 / 528×420 next to the sidebar, 500 / 655 without it).
 */
export function CatalogueGrid({ groups, cards, sort, defaultOpen = false, basePath = "/catalogue" }: Props) {
  const [open, setOpen] = useState(defaultOpen);

  const rows: ProductCardData[][] = [];
  for (let i = 0, wide = false; i < cards.length; wide = !wide) {
    const n = wide ? 2 : 3;
    rows.push(cards.slice(i, i + n));
    i += n;
  }

  return (
    <section className="mx-auto flex w-full max-w-[1440px] flex-col gap-[45px] px-4 md:px-10">
      <div className="flex flex-col gap-[11px]">
        <div className="flex h-6 items-center justify-between">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="catalogue-filters"
            className="flex items-center gap-2 text-[18px] font-semibold uppercase leading-none text-[#1a1c18]"
          >
            Filters
            <CaretIcon className={cn("size-4 transition-transform duration-300", open && "rotate-180")} />
          </button>
          <Suspense>
            <SortSelect value={sort} basePath={basePath} />
          </Suspense>
        </div>
        <hr className="border-line" />
      </div>

      <div className="flex flex-col lg:flex-row lg:items-start">
        <div
          id="catalogue-filters"
          className={cn(
            "overflow-hidden transition-[width,opacity,margin] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] lg:shrink-0",
            open ? "mb-12 w-full opacity-100 lg:mb-0 lg:w-[302px]" : "h-0 w-full opacity-0 lg:w-0"
          )}
          inert={!open}
        >
          <div className="lg:w-[302px]">
            <Suspense>
              <Filters groups={groups} basePath={basePath} />
            </Suspense>
          </div>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-4 lg:gap-[60px]">
          {rows.map((row, i) => (
            <div
              key={i}
              className={cn(
                "grid transition-[gap] duration-500",
                open ? "gap-3" : "gap-4",
                row.length === 2 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1 md:grid-cols-3"
              )}
            >
              {row.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  compact={open}
                  className={cn(
                    "transition-[height] duration-500",
                    open
                      ? row.length === 2
                        ? "h-[420px]"
                        : "h-[348px]"
                      : row.length === 2
                        ? "h-[420px] lg:h-[655px]"
                        : "h-[420px] lg:h-[500px]"
                  )}
                />
              ))}
            </div>
          ))}
          {cards.length === 0 && <p className="text-secondary">No products match these filters.</p>}
        </div>
      </div>
    </section>
  );
}
