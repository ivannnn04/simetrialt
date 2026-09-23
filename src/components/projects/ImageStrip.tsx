"use client";

import { useEffect, useRef, useState } from "react";
import { Photo } from "@/components/ui/Photo";
import { ArrowIcon } from "@/components/ui/Icons";
import { cn } from "@/lib/cn";

/**
 * Figma "images" (node 4217:47574): 674×700 photos in a strip that overflows the viewport on
 * both sides. On every width the neighbouring photos peek in from the edges, the strip can be
 * dragged, and a progress bar with arrows (plus a hint on touch screens) shows it scrolls.
 * The pointer becomes the "Scroll to view" circle over the strip (CursorLabel).
 */
export function ImageStrip({ images }: { images: string[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0); // 0..1 of the scrollable distance
  const [thumb, setThumb] = useState(0.3); // visible fraction of the strip
  const drag = useRef<{ x: number; left: number; moved: boolean } | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const max = el.scrollWidth - el.clientWidth;
      setProgress(max > 0 ? el.scrollLeft / max : 0);
      setThumb(el.scrollWidth > 0 ? el.clientWidth / el.scrollWidth : 1);
    };
    el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2; // open centred like the design
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, []);

  const step = (dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>("[data-strip-item]");
    el.scrollBy({ left: dir * ((card?.offsetWidth ?? 400) + 8), behavior: "smooth" });
  };

  return (
    <section className="relative w-full" data-cursor="Scroll to view" data-cursor-size="lg">
      <div
        ref={ref}
        className={cn(
          "w-full snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          drag.current ? "cursor-grabbing" : "cursor-grab"
        )}
        onPointerDown={(e) => {
          if (e.pointerType !== "mouse") return;
          drag.current = { x: e.clientX, left: e.currentTarget.scrollLeft, moved: false };
          e.currentTarget.classList.remove("snap-x");
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          const dx = e.clientX - d.x;
          if (Math.abs(dx) > 3) d.moved = true;
          e.currentTarget.scrollLeft = d.left - dx;
        }}
        onPointerUp={(e) => {
          drag.current = null;
          e.currentTarget.classList.add("snap-x");
        }}
        onPointerLeave={(e) => {
          drag.current = null;
          e.currentTarget.classList.add("snap-x");
        }}
      >
        {/* Photo width leaves ~14% of the viewport for the neighbours on phones, more on wider screens */}
        <div className="flex w-max gap-2">
          {images.map((src, i) => (
            <div key={i} data-strip-item className="shrink-0 snap-center">
              <Photo src={src} className="h-[76vw] w-[72vw] sm:h-[58vw] sm:w-[56vw] md:h-[50vw] md:w-[48vw] lg:h-[700px] lg:w-[674px]" />
            </div>
          ))}
        </div>
      </div>

      {/* Scroll affordance: progress bar and arrows; the hint text shows where there is no pointer label */}
      <div className="mx-auto mt-6 flex w-full max-w-[1440px] items-center gap-6 px-4 md:px-10">
        <div className="relative h-px flex-1 bg-line" aria-hidden>
          <div
            className="absolute top-0 h-px bg-dark transition-[left] duration-150 ease-out"
            style={{ width: `${thumb * 100}%`, left: `${progress * (1 - thumb) * 100}%` }}
          />
        </div>
        <p className="text-[13px] leading-none tracking-[-0.04em] text-secondary lg:hidden">Scroll to view</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Previous image"
            onClick={() => step(-1)}
            className="flex size-[38px] items-center justify-center border border-line text-ink transition-colors hover:border-dark hover:bg-dark hover:text-white lg:size-[46px]"
          >
            <ArrowIcon className="size-5 rotate-180" />
          </button>
          <button
            type="button"
            aria-label="Next image"
            onClick={() => step(1)}
            className="flex size-[38px] items-center justify-center border border-line text-ink transition-colors hover:border-dark hover:bg-dark hover:text-white lg:size-[46px]"
          >
            <ArrowIcon className="size-5" />
          </button>
        </div>
      </div>
    </section>
  );
}
