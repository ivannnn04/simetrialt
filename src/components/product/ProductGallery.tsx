"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/cn";

type Props = { images: (string | null | undefined)[]; name: string };

/**
 * Product photos: a vertical stack next to the info column on desktop (Figma node 4217:46872);
 * up to 1024px a horizontal snap slider with dots, and the info column follows below.
 */
export function ProductGallery({ images, name }: Props) {
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  const onScroll = () => {
    const el = track.current;
    if (!el) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i !== active) setActive(i);
  };

  const goTo = (i: number) => track.current?.scrollTo({ left: i * track.current.clientWidth, behavior: "smooth" });

  return (
    <div className="flex flex-col gap-4">
      <div
        ref={track}
        onScroll={onScroll}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden min-[1025px]:snap-none min-[1025px]:flex-col min-[1025px]:overflow-visible"
      >
        {images.map((src, i) => (
          <figure
            key={i}
            className="flex aspect-[640/452] w-full shrink-0 snap-start items-center justify-center overflow-hidden bg-[#f2f2f2]"
          >
            {src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={src}
                alt={i === 0 ? name : ""}
                draggable={false}
                className={i === 0 ? "max-h-[86%] max-w-[70%] object-contain" : "size-full object-cover"}
              />
            ) : null}
          </figure>
        ))}
      </div>
      {images.length > 1 && (
        <div className="flex items-center justify-center gap-2 min-[1025px]:hidden" role="tablist" aria-label="Photos">
          {images.map((_, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === active}
              aria-label={`Photo ${i + 1}`}
              onClick={() => goTo(i)}
              className={cn("size-2 rounded-full transition-colors", i === active ? "bg-dark" : "bg-line hover:bg-tertiary")}
            />
          ))}
        </div>
      )}
    </div>
  );
}
