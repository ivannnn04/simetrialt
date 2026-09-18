"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import type { ServiceStage } from "@/data/services";

/**
 * Figma "how we work" (node 4048:30522). Geometry per point (225 × 150 box):
 *   pill (38px) → 12px gap → dot (18px) with its centre at y = 59, the line runs through it.
 *   Odd points are mirrored (dot above, pill below). The active description sits 27px from the
 *   dot: below it for "pill above" points, above it for "pill below" points.
 * A progress line sweeps left → right; the point it last passed is active. Hovering a point
 * moves the line there and pauses; clicking a dot sends the line to it and playback continues.
 */
const BOX = 150;
const DOT = 18;
const PILL = 38;
const GAP = 12;
const DOT_TOP = 50; // dot centre at 59px
const LINE_TOP = DOT_TOP + DOT / 2;
const DESC_GAP = 27; // dot → description
const SWEEP_MS = 16000; // full left → right pass
const SEEK_PX_PER_MS = 2.4; // speed when jumping to a clicked dot

export function StagesTimeline({ stages }: { stages: ServiceStage[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dotRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const [progress, setProgress] = useState(0); // px from the left edge of the track
  const [dots, setDots] = useState<number[]>([]); // dot centres, px from the track's left edge
  const [width, setWidth] = useState(0);

  const progressRef = useRef(0);
  const pausedRef = useRef(false);
  const targetRef = useRef<number | null>(null);
  const widthRef = useRef(0);

  // Measure dot positions and the track width (re-run on resize).
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const measure = () => {
      const rect = track.getBoundingClientRect();
      widthRef.current = rect.width;
      setWidth(rect.width);
      setDots(
        dotRefs.current.map((el) => {
          if (!el) return 0;
          const r = el.getBoundingClientRect();
          return r.left - rect.left + r.width / 2;
        })
      );
    };
    const ro = new ResizeObserver(measure);
    ro.observe(track);
    return () => ro.disconnect();
  }, [stages.length]);

  // Sweep animation.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(64, now - last);
      last = now;
      const w = widthRef.current;
      if (w > 0 && !pausedRef.current) {
        let p = progressRef.current;
        const target = targetRef.current;
        if (target !== null) {
          const step = SEEK_PX_PER_MS * dt;
          if (Math.abs(target - p) <= step) {
            p = target;
            targetRef.current = null;
          } else {
            p += Math.sign(target - p) * step;
          }
        } else {
          p += (w / SWEEP_MS) * dt;
          if (p > w) p = 0;
        }
        progressRef.current = p;
        setProgress(p);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const active = dots.reduce((acc, x, i) => (x <= progress + 0.5 ? i : acc), 0);

  const jumpTo = useCallback(
    (i: number, pause: boolean) => {
      const x = dots[i];
      if (x === undefined) return;
      if (pause) {
        progressRef.current = x;
        targetRef.current = null;
        pausedRef.current = true;
        setProgress(x);
      } else {
        targetRef.current = x;
      }
    },
    [dots]
  );
  const resume = useCallback(() => {
    pausedRef.current = false;
  }, []);

  return (
    <div className="w-full">
      {/* Desktop: sweeping line + alternating points */}
      <div ref={trackRef} className="relative hidden w-full xl:block" style={{ paddingTop: 0 }}>
        <div className="absolute left-0 right-0 h-px bg-line" style={{ top: LINE_TOP }} aria-hidden />
        <div
          className="absolute left-0 h-px bg-dark"
          style={{ top: LINE_TOP, width: Math.min(progress, width) }}
          aria-hidden
        />
        <ol className="relative mx-auto flex w-max items-start gap-[58px]">
          {stages.map((stage, i) => {
            const below = i % 2 === 1;
            const isActive = i === active;
            const passed = i <= active; // dots the line has already reached stay dark
            return (
              <li
                key={stage.label}
                className="relative w-[225px]"
                style={{ height: BOX }}
                onMouseEnter={() => jumpTo(i, true)}
                onMouseLeave={resume}
              >
                <button
                  type="button"
                  onClick={() => jumpTo(i, false)}
                  aria-label={`Go to stage: ${stage.label}`}
                  aria-pressed={isActive}
                  className="absolute left-1/2 z-10 -translate-x-1/2 p-1"
                  style={{ top: DOT_TOP - 4 }}
                >
                  <span
                    ref={(el) => {
                      dotRefs.current[i] = el;
                    }}
                    className={cn(
                      "block rounded-full border transition-colors duration-300",
                      passed ? "border-dark bg-dark" : "border-[#c6c6c6] bg-cream"
                    )}
                    style={{ width: DOT, height: DOT }}
                  />
                </button>
                <button
                  type="button"
                  onClick={() => jumpTo(i, false)}
                  onFocus={() => jumpTo(i, true)}
                  onBlur={resume}
                  className={cn(
                    "absolute left-1/2 flex w-[220px] -translate-x-1/2 items-center justify-center whitespace-nowrap rounded-[50px] border px-6 pb-[11px] pt-[9px] text-[14px] font-medium leading-[1.3] tracking-[-0.04em] transition-colors duration-300",
                    isActive ? "border-dark bg-dark text-white" : "border-[#c6c6c6] text-[#1f1f1f] hover:border-dark"
                  )}
                  style={below ? { top: DOT_TOP + DOT + GAP } : { top: DOT_TOP - GAP - PILL }}
                >
                  {stage.label}
                </button>
                <p
                  className={cn(
                    "absolute left-0 w-full text-[13px] leading-[1.3] tracking-[-0.04em] text-[#2e2e2e]/80 transition-opacity duration-300",
                    isActive ? "opacity-100" : "opacity-0"
                  )}
                  style={below ? { bottom: BOX - (DOT_TOP - DESC_GAP) } : { top: DOT_TOP + DOT + DESC_GAP }}
                  aria-hidden={!isActive}
                >
                  {stage.text}
                </p>
              </li>
            );
          })}
        </ol>
        {/* room for a description under "pill above" points (dot bottom + 27px + 3 lines) */}
        <div style={{ height: DOT_TOP + DOT + DESC_GAP + 52 - BOX }} aria-hidden />
      </div>

      {/* Mobile / tablet: vertical list */}
      <ol className="flex flex-col gap-6 border-l border-line pl-6 xl:hidden">
        {stages.map((stage, i) => (
          <li key={stage.label} className="relative flex flex-col gap-2">
            <span
              className={cn(
                "absolute -left-[33px] top-1 block size-[18px] rounded-full border",
                i === 0 ? "border-dark bg-dark" : "border-[#c6c6c6] bg-cream"
              )}
            />
            <span className="inline-flex w-max rounded-[50px] border border-[#c6c6c6] px-6 pb-[11px] pt-[9px] text-[14px] font-medium leading-[1.3] tracking-[-0.04em] text-[#1f1f1f]">
              {stage.label}
            </span>
            <p className="max-w-[420px] text-[13px] leading-[1.3] tracking-[-0.04em] text-[#2e2e2e]/80">{stage.text}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
