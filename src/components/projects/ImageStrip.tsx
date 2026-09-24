"use client";

import { useEffect, useRef } from "react";
import { Photo } from "@/components/ui/Photo";

/**
 * Figma "images" (node 4217:47574): 674×700 photos in a strip that overflows the viewport on
 * both sides. Photos are sized so the neighbours peek in from the edges on every width; the
 * strip scrolls horizontally (drag with the mouse, swipe on touch) and opens centred like the
 * design. The pointer becomes the "Scroll to view" circle over the strip (CursorLabel).
 */
export function ImageStrip({ images }: { images: string[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; left: number } | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
  }, []);

  return (
    <section className="relative w-full" data-cursor="Scroll to view" data-cursor-size="lg">
      <div
        ref={ref}
        className="w-full cursor-grab overflow-x-auto [scrollbar-width:none] active:cursor-grabbing [&::-webkit-scrollbar]:hidden"
        onPointerDown={(e) => {
          if (e.pointerType !== "mouse") return;
          drag.current = { x: e.clientX, left: e.currentTarget.scrollLeft };
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (d) e.currentTarget.scrollLeft = d.left - (e.clientX - d.x);
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onPointerLeave={() => {
          drag.current = null;
        }}
      >
        {/* Photo width leaves room for the neighbours: ~72% of the viewport on phones, less on wider screens */}
        <div className="flex w-max gap-2">
          {images.map((src, i) => (
            <Photo key={i} src={src} className="h-[76vw] w-[72vw] shrink-0 sm:h-[58vw] sm:w-[56vw] md:h-[50vw] md:w-[48vw] lg:h-[700px] lg:w-[674px]" />
          ))}
        </div>
      </div>
    </section>
  );
}
