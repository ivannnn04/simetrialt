"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { ArrowIcon } from "@/components/ui/Icons";
import { ProductCard, type ProductCardData } from "@/components/catalogue/ProductCard";

const GAP = 16;

type Props = {
  products: ProductCardData[];
  cardClassName?: string;
  title: React.ReactNode;
  /** Let the track run past the right edge of the container (clipped by an ancestor, e.g. the viewport). */
  bleed?: boolean;
};

/** Figma "products best" (node 4217:47656): 3 cards per view, arrow buttons step through the list and loop. */
export function ProductSlider({ products, cardClassName, title, bleed = false }: Props) {
  const viewport = useRef<HTMLDivElement>(null);
  const [perView, setPerView] = useState(3);
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      setWidth(w);
      setPerView(w >= 1024 ? 3 : w >= 640 ? 2 : 1);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const cardW = width ? (width - GAP * (perView - 1)) / perView : 0;
  const maxIndex = Math.max(0, products.length - perView);
  const canSlide = products.length > perView;
  const go = (dir: 1 | -1) => setIndex((i) => (canSlide ? (i + dir + maxIndex + 1) % (maxIndex + 1) : 0));

  return (
    <div className="flex w-full flex-col gap-10">
      <div className="flex w-full items-center justify-between">
        {title}
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Previous products"
            disabled={!canSlide}
            onClick={() => go(-1)}
            className="flex size-[46px] items-center justify-center border border-line text-ink transition-colors hover:border-dark hover:bg-dark hover:text-white disabled:cursor-default disabled:opacity-40 disabled:hover:border-line disabled:hover:bg-transparent disabled:hover:text-ink"
          >
            <ArrowIcon className="rotate-180" />
          </button>
          <button
            type="button"
            aria-label="Next products"
            disabled={!canSlide}
            onClick={() => go(1)}
            className="flex size-[46px] items-center justify-center border border-line text-ink transition-colors hover:border-dark hover:bg-dark hover:text-white disabled:cursor-default disabled:opacity-40 disabled:hover:border-line disabled:hover:bg-transparent disabled:hover:text-ink"
          >
            <ArrowIcon />
          </button>
        </div>
      </div>
      <div ref={viewport} className={cn("w-full", bleed ? "overflow-visible" : "overflow-hidden")}>
        <div
          className="flex transition-transform duration-500 ease-out"
          style={{ gap: GAP, transform: `translateX(-${Math.min(index, maxIndex) * (cardW + GAP)}px)` }}
        >
          {products.map((p) => (
            <div key={p.id} className="shrink-0" style={{ width: cardW || undefined }}>
              <ProductCard product={p} className={cn("h-[449px]", cardClassName)} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
