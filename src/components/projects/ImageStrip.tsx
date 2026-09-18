"use client";

import { useEffect, useRef } from "react";
import { Photo } from "@/components/ui/Photo";

/**
 * Figma "images" (node 4217:47574): three 674×700 photos in a 2038px strip that overflows the
 * viewport on both sides. Scrolls horizontally; opens centred like the design. The pointer
 * becomes the "Scroll to view" circle over the strip (CursorLabel).
 */
export function ImageStrip({ images }: { images: string[] }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
  }, []);

  return (
    <section className="relative w-full" data-cursor="Scroll to view" data-cursor-size="lg">
      <div ref={ref} className="w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex h-[420px] w-max gap-2 lg:h-[700px]">
          {images.map((src, i) => (
            <Photo key={i} src={src} className="h-full w-[420px] lg:w-[674px]" />
          ))}
        </div>
      </div>
    </section>
  );
}
