"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

export type FeatureSlide = { title: string; text: string };

type Props = {
  slides: FeatureSlide[];
  /** Autoplay only while the section is actually on screen. */
  playing?: boolean;
  interval?: number;
  className?: string;
};

/**
 * Figma "features" (node 4217:47655): centred title/text over a photo with a row of
 * long bars underneath. Each bar is a slide; the active one fills up over `interval`
 * and the slider loops automatically. Clicking a bar jumps to that slide.
 */
export function FeatureSlider({ slides, playing = true, interval = 5000, className }: Props) {
  const [index, setIndex] = useState(0);
  const [run, setRun] = useState(0); // bumps to restart the fill when a bar is clicked

  useEffect(() => {
    if (!playing || slides.length < 2) return;
    const t = setTimeout(() => setIndex((i) => (i + 1) % slides.length), interval);
    return () => clearTimeout(t);
  }, [index, run, playing, interval, slides.length]);

  const slide = slides[index] ?? slides[0];

  return (
    <div className={cn("flex w-full flex-col items-center gap-14", className)}>
      <div key={`${index}-${run}`} className="feature-slide flex flex-col items-center gap-6 px-4 text-center text-white">
        <h2 className="text-[44px] font-medium leading-none tracking-[-0.04em] md:text-[74px]">{slide.title}</h2>
        <p className="max-w-[598px] text-[16px] leading-[1.3] tracking-[-0.04em]">{slide.text}</p>
      </div>
      <div className="flex w-full items-center gap-2" role="tablist" aria-label="Slides">
        {slides.map((s, i) => (
          <button
            key={s.title}
            type="button"
            role="tab"
            aria-selected={i === index}
            aria-label={s.title}
            onClick={() => {
              setIndex(i);
              setRun((r) => r + 1);
            }}
            className="relative h-2 flex-1 overflow-hidden bg-cream/20"
          >
            {i < index && <span className="absolute inset-0 bg-cream" />}
            {i === index && (
              <span
                key={run}
                className="feature-fill absolute inset-y-0 left-0 bg-cream"
                style={{ animationDuration: `${interval}ms`, animationPlayState: playing ? "running" : "paused" }}
              />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
