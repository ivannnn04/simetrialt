"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { DotButton } from "@/components/ui/Button";
import { Photo } from "@/components/ui/Photo";

export type ProjectSlide = {
  category: string;
  title: string;
  text: string;
  info: [string, string][];
  cta?: { label: string; href: string };
};

type Props = {
  slides: ProjectSlide[];
  image: string;
  interval?: number;
};

const SLIDE_HEIGHT = 800;

/**
 * Figma "projects" (node 4129:25960): full-bleed photo with a frosted panel on the left and a
 * vertical pagination column bottom-right. Slides move vertically (translateY), the active
 * bullet stretches into a bar. Autoplays in a loop; clicking a bullet jumps to that slide.
 */
export function ProjectsSlider({ slides, image, interval = 6000 }: Props) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (slides.length < 2) return;
    const t = setTimeout(() => setIndex((i) => (i + 1) % slides.length), interval);
    return () => clearTimeout(t);
  }, [index, interval, slides.length]);

  return (
    <section id="projects" className="relative w-full">
      <Photo src={image} className="w-full">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0)_0%,rgba(0,0,0,0.5)_100%)]" />
        <div className="relative mx-auto flex max-w-[1440px] items-end justify-between">
          <div
            className="w-full overflow-hidden bg-cream/10 backdrop-blur-[7.5px] lg:w-[576px]"
            style={{ height: SLIDE_HEIGHT }}
            aria-live="polite"
          >
            <div
              className="flex flex-col transition-transform duration-700 ease-[cubic-bezier(0.65,0,0.35,1)]"
              style={{ transform: `translateY(-${index * SLIDE_HEIGHT}px)` }}
            >
              {slides.map((s, i) => (
                <div
                  key={s.title}
                  aria-hidden={i !== index}
                  className="flex shrink-0 flex-col justify-between px-4 pb-10 pt-[200px] md:px-10"
                  style={{ height: SLIDE_HEIGHT }}
                >
                  <div className="flex flex-col gap-6 text-white">
                    <div className="flex max-w-[478px] flex-col gap-4">
                      <p className="text-[18px] font-semibold leading-none tracking-[-0.04em]">/ {s.category}</p>
                      <h2 className="max-w-[490px] text-[56px] font-medium leading-[0.9] tracking-[-0.04em] md:text-[80px]">
                        {s.title}
                      </h2>
                      <p className="text-[16px] leading-[1.3] tracking-[-0.04em]">{s.text}</p>
                    </div>
                    <div>
                      <DotButton variant="primary" href={s.cta?.href ?? "/projects"} className={cn(i !== index && "pointer-events-none")}>
                        {s.cta?.label ?? "Explore products"}
                      </DotButton>
                    </div>
                  </div>
                  <dl className="mt-16 flex w-full max-w-[330px] flex-col gap-1.5 text-[14px] leading-none tracking-[-0.04em] text-tertiary">
                    {s.info.map(([k, v]) => (
                      <div key={k} className="flex items-center justify-between border-b border-white/30 py-1.5">
                        <dt>{k}</dt>
                        <dd>{v}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ))}
            </div>
          </div>
          <div className="absolute bottom-10 right-4 flex flex-col gap-2 md:right-10 lg:static lg:pb-10 lg:pr-10" role="tablist" aria-label="Projects">
            {slides.map((s, i) => (
              <button
                key={s.title}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={s.title}
                onClick={() => setIndex(i)}
                className={cn(
                  "w-2 rounded-[10px] transition-all duration-500",
                  i === index ? "h-[38px] bg-white" : "h-2 bg-cream/40 hover:bg-cream/70"
                )}
              />
            ))}
          </div>
        </div>
      </Photo>
    </section>
  );
}
