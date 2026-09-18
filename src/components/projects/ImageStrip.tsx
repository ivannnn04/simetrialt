"use client";

import { useEffect, useRef } from "react";
import { Photo } from "@/components/ui/Photo";

/**
 * Figma "images" (node 4217:47574): three 674×700 photos in a 2038px strip that overflows the
 * viewport on both sides. Scrolls horizontally; opens centred like the design.
 */
export function ImageStrip({ images }: { images: string[] }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
  }, []);

  return (
    <section className="relative w-full">
      <div ref={ref} className="w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex h-[420px] w-max gap-2 lg:h-[700px]">
          {images.map((src, i) => (
            <Photo key={i} src={src} className="h-full w-[420px] lg:w-[674px]" />
          ))}
        </div>
      </div>
      <span className="pointer-events-none absolute left-1/2 top-1/2 hidden size-[150px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/20 text-center text-[18px] leading-[1.3] tracking-[-0.04em] text-white backdrop-blur-sm xl:flex">
        Scroll to view
      </span>
    </section>
  );
}
