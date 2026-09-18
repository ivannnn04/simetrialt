"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { DotButton } from "@/components/ui/Button";
import { Badge } from "@/components/site/Sections";
import { PLACEHOLDER_IMAGE } from "@/lib/placeholder";
import { FeatureSlider, type FeatureSlide } from "@/components/home/FeatureSlider";

const CARD_W = 334; // Figma "2 section / with image" (node 4189:22881)
const CARD_H = 434;
const HEIGHT_VH = 350; // scroll distance the pinned scene occupies

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const range = (p: number, from: number, to: number) => clamp01((p - from) / (to - from));
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

type Props = {
  image: string;
  slides: FeatureSlide[];
};

/**
 * Sections 2 → 3 of the home page as one pinned scroll scene:
 * the "Why architects" copy sits in view, a portrait image scales up from the
 * centre of the screen, grows into the full-bleed background of "Long-term
 * partnerships", and that section's content fades in once the image has landed.
 */
export function ScrollReveal({ image, slides }: Props) {
  const ref = useRef<HTMLElement>(null);
  const [p, setP] = useState(0);
  const [size, setSize] = useState({ w: 1440, h: 900 });
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    let raf = 0;
    const update = () => {
      raf = 0;
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      setP(total > 0 ? clamp01(-rect.top / total) : 1);
      setSize({ w: window.innerWidth, h: window.innerHeight });
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    raf = requestAnimationFrame(() => {
      setReduced(mq.matches);
      update();
    });
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const src = PLACEHOLDER_IMAGE ?? image;

  // Timeline (fractions of the pinned scroll distance)
  const pop = easeOut(range(p, 0.1, 0.38)); // portrait card scales up from 0 in the centre
  const grow = easeInOut(range(p, 0.34, 0.72)); // card grows into the full-bleed background
  const copyOut = 1 - range(p, 0.5, 0.66); // section-2 copy fades once mostly covered
  const featureIn = range(p, 0.78, 0.94); // section-3 content fades in after landing
  const shade = range(p, 0.4, 0.8); // dark gradient strengthens as the image lands

  const cardW = Math.min(CARD_W, size.w - 32);
  const cardH = Math.min(CARD_H, size.h - 32);
  const boxW = lerp(cardW, size.w, grow);
  const boxH = lerp(cardH, size.h, grow);

  const scrollToReveal = () => {
    const el = ref.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: top + (el.offsetHeight - window.innerHeight) * 0.45, behavior: "smooth" });
  };

  if (reduced) {
    return (
      <>
        <section className="w-full bg-cream px-4 py-[120px] md:px-10 lg:py-[240px]">
          <WhyCopy />
        </section>
        <section
          className="relative flex w-full flex-col items-center gap-14 bg-cover bg-center pt-[320px] lg:pt-[526px]"
          style={{ backgroundImage: `url(${src})` }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/50 to-black/70" />
          <FeatureSlider slides={slides} className="relative" />
        </section>
      </>
    );
  }

  return (
    <section ref={ref} id="features" className="relative w-full bg-cream" style={{ height: `${HEIGHT_VH}vh` }}>
      <div className="sticky top-0 h-screen w-full overflow-hidden">
        {/* Section 2 copy */}
        <div
          className="absolute inset-0 flex items-center justify-center px-4 md:px-10"
          style={{ opacity: copyOut, pointerEvents: copyOut > 0.5 ? "auto" : "none" }}
        >
          <WhyCopy onScroll={scrollToReveal} />
        </div>

        {/* The growing image: a portrait card that pops in from scale 0, then expands to the viewport */}
        <div
          aria-hidden
          className="absolute left-1/2 top-1/2 bg-cover bg-center will-change-transform"
          style={{
            width: boxW,
            height: boxH,
            backgroundImage: `url(${src}), linear-gradient(165deg, #4b4641 0%, #2b2825 55%, #171615 100%)`,
            transform: `translate(-50%, -50%) scale(${pop})`,
            opacity: pop > 0 ? 1 : 0,
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/50 to-black/70" style={{ opacity: 0.4 + 0.6 * shade }} />
        </div>

        {/* Section 3 content */}
        <div
          className={cn("absolute inset-0 flex flex-col items-center justify-end gap-14", featureIn === 0 && "pointer-events-none")}
          style={{ opacity: featureIn, transform: `translateY(${(1 - featureIn) * 24}px)` }}
        >
          <FeatureSlider slides={slides} playing={featureIn > 0.5} />
        </div>
      </div>
    </section>
  );
}

function WhyCopy({ onScroll }: { onScroll?: () => void }) {
  return (
    <div className="mx-auto flex w-full max-w-[1360px] flex-col items-center gap-8">
      <div className="flex flex-col items-center gap-4 text-center">
        <Badge className="text-ink">Why architects work with us</Badge>
        <h2 className="max-w-[725px] text-[40px] font-medium leading-none tracking-[-0.04em] text-ink md:text-[64px]">
          Everything architects need in a design partner
        </h2>
      </div>
      <DotButton onClick={onScroll} href={onScroll ? undefined : "#features"}>
        Scroll
      </DotButton>
    </div>
  );
}
