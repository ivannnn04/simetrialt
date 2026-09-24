"use client";

import { Suspense, useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { CaretIcon, CloseIcon } from "@/components/ui/Icons";
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

const DESKTOP = "(min-width: 64rem)";

/**
 * Figma "Furniture Products" (4217:47838, filters open) / "filter-v2" (4217:46770, closed):
 * FILTERS toggle + sort on one line, a collapsible 302px sidebar and a grid that alternates rows
 * of three square and two wide cards (348 / 528×420 next to the sidebar, 500 / 655 without it).
 * Below lg the sidebar becomes a drawer that slides in from the left over the page.
 */
export function CatalogueGrid({ groups, cards, sort, defaultOpen = false, basePath = "/catalogue" }: Props) {
  const [open, setOpen] = useState(defaultOpen); // desktop inline sidebar
  const [drawer, setDrawer] = useState(false); // mobile / tablet drawer

  const toggle = () => {
    if (window.matchMedia(DESKTOP).matches) setOpen((v) => !v);
    else setDrawer((v) => !v);
  };

  // Lock the page behind the drawer and close it with Escape or when the viewport grows to desktop.
  useEffect(() => {
    if (!drawer) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDrawer(false);
    const mq = window.matchMedia(DESKTOP);
    const onChange = (e: MediaQueryListEvent) => e.matches && setDrawer(false);
    window.addEventListener("keydown", onKey);
    mq.addEventListener("change", onChange);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
      mq.removeEventListener("change", onChange);
    };
  }, [drawer]);

  // Rows follow the 3 / 2 / 3 pattern by position, even when the last row is not full.
  const rows: { items: ProductCardData[]; wide: boolean }[] = [];
  for (let i = 0, wide = false; i < cards.length; wide = !wide) {
    const n = wide ? 2 : 3;
    rows.push({ items: cards.slice(i, i + n), wide });
    i += n;
  }

  return (
    <section className="mx-auto flex w-full max-w-[1440px] flex-col gap-[45px] px-4 md:px-10">
      <div className="flex flex-col gap-[11px]">
        <div className="flex h-6 items-center justify-between">
          <button
            type="button"
            onClick={toggle}
            aria-expanded={open || drawer}
            aria-controls="catalogue-filters"
            className="flex items-center gap-2 text-[18px] font-semibold uppercase leading-none text-[#1a1c18]"
          >
            Filters
            <CaretIcon className={cn("size-4 transition-transform duration-300", open && "lg:rotate-180")} />
          </button>
          <Suspense>
            <SortSelect value={sort} basePath={basePath} />
          </Suspense>
        </div>
        <hr className="border-line" />
      </div>

      {/* Drawer (below lg) */}
      <div
        className={cn("fixed inset-0 z-[80] lg:hidden", drawer ? "pointer-events-auto" : "pointer-events-none")}
        aria-hidden={!drawer}
      >
        <button
          type="button"
          aria-label="Close filters"
          onClick={() => setDrawer(false)}
          className={cn("absolute inset-0 bg-black/40 transition-opacity duration-300", drawer ? "opacity-100" : "opacity-0")}
        />
        <div
          id="catalogue-filters-drawer"
          role="dialog"
          aria-modal="true"
          aria-label="Filters"
          inert={!drawer}
          className={cn(
            "absolute inset-y-0 left-0 flex w-[min(360px,88vw)] flex-col bg-white shadow-xl transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
            drawer ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <span className="text-[18px] font-semibold uppercase leading-none text-[#1a1c18]">Filters</span>
            <button type="button" onClick={() => setDrawer(false)} aria-label="Close filters" className="-mr-2 p-2 text-black">
              <CloseIcon className="size-5" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <Suspense>
              <Filters groups={groups} basePath={basePath} />
            </Suspense>
          </div>
          <div className="border-t border-line p-4">
            <button
              type="button"
              onClick={() => setDrawer(false)}
              className="w-full bg-dark px-8 py-[14px] text-center text-[14px] font-medium text-white transition-colors hover:bg-black"
            >
              Show results
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-start">
        {/* Inline sidebar (lg and up) */}
        <div
          id="catalogue-filters"
          className={cn(
            "hidden overflow-hidden transition-[width,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] lg:block lg:shrink-0",
            open ? "lg:w-[302px] opacity-100" : "lg:w-0 opacity-0"
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
                row.wide ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1 md:grid-cols-3"
              )}
            >
              {row.items.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  compact={open}
                  className={cn(
                    "transition-[height] duration-500",
                    open
                      ? row.wide
                        ? "h-[420px]"
                        : "h-[348px]"
                      : row.wide
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
