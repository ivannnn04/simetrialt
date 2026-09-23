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
const PER_ROW = 3; // tablet layout: points per row
const ROWS = 2;
const CORNER = 24; // tablet layout: radius of the two turns
const ARC = (Math.PI * CORNER) / 2;

export function StagesTimeline({ stages }: { stages: ServiceStage[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const rowsRef = useRef<HTMLDivElement>(null);
  const vTrackRef = useRef<HTMLOListElement>(null);
  const dotRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const rDotRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const vDotRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const [path, setPath] = useState<{ d: string; total: number; w: number; h: number } | null>(null); // tablet path
  const rowElRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [progress, setProgress] = useState(0); // px from the left edge of the track
  const [dots, setDots] = useState<number[]>([]); // dot centres, px from the track's left edge
  const [width, setWidth] = useState(0);

  const progressRef = useRef(0);
  const pausedRef = useRef(false);
  const targetRef = useRef<number | null>(null);
  const widthRef = useRef(0);

  // Measure dot positions along the visible track. Three layouts share one progress value
  // (px along the track): ≥1280 one horizontal line; 768–1279 two rows of three points, the
  // line runs through row one then row two (positions are cumulative); <768 a vertical line.
  useEffect(() => {
    const track = trackRef.current;
    const rows = rowsRef.current;
    const vTrack = vTrackRef.current;
    if (!track || !rows || !vTrack) return;
    const measure = () => {
      const desktop = window.matchMedia("(min-width: 80rem)").matches;
      const tablet = !desktop && window.matchMedia("(min-width: 48rem)").matches;
      let extent = 0;
      let centres: number[] = [];
      if (desktop) {
        const rect = track.getBoundingClientRect();
        extent = rect.width;
        centres = dotRefs.current.map((d) => (d ? d.getBoundingClientRect().left - rect.left + d.getBoundingClientRect().width / 2 : 0));
      } else if (tablet) {
        // Serpentine path with rounded turns: row one left → right, down the right edge, row two
        // right → left to the edge. Progress is the distance along that path.
        const rect = rows.getBoundingClientRect();
        const r0 = rowElRefs.current[0]?.getBoundingClientRect();
        const r1 = rowElRefs.current[1]?.getBoundingClientRect();
        const w = rect.width;
        const y1 = LINE_TOP;
        const y2 = r0 && r1 ? r1.top - r0.top + LINE_TOP : y1;
        const link = Math.max(0, y2 - y1 - 2 * CORNER);
        const along = (i: number, x: number) => (i < PER_ROW ? x : w - CORNER + ARC + link + ARC + (w - CORNER - x));
        centres = rDotRefs.current.map((d, i) => {
          if (!d) return 0;
          const c = d.getBoundingClientRect();
          return along(i, c.left - rect.left + c.width / 2);
        });
        // the grey path runs on to the left edge; the sweep still ends at the last point
        const total = centres[centres.length - 1] ?? 0;
        const d = `M0 ${y1} H${w - CORNER} A${CORNER} ${CORNER} 0 0 1 ${w} ${y1 + CORNER} V${y2 - CORNER} A${CORNER} ${CORNER} 0 0 1 ${w - CORNER} ${y2} H0`;
        setPath({ d, total, w, h: rect.height });
        extent = total;
      } else {
        const rect = vTrack.getBoundingClientRect();
        extent = rect.height;
        centres = vDotRefs.current.map((d) => (d ? d.getBoundingClientRect().top - rect.top + d.getBoundingClientRect().height / 2 : 0));
      }
      widthRef.current = extent;
      setWidth(extent);
      setDots(centres);
      progressRef.current = Math.min(progressRef.current, extent);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(track);
    ro.observe(rows);
    rowElRefs.current.forEach((el) => el && ro.observe(el));
    ro.observe(vTrack);
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

  const setDesktopDot = (i: number, el: HTMLSpanElement | null) => {
    dotRefs.current[i] = el;
  };
  const setRowDot = (i: number, el: HTMLSpanElement | null) => {
    rDotRefs.current[i] = el;
  };

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
        <ol className="relative mx-auto flex w-full max-w-[1360px] items-start gap-6 min-[1440px]:gap-[58px]">
          {stages.map((stage, i) => (
            <Point key={stage.label} stage={stage} i={i} active={active} setDot={setDesktopDot} jumpTo={jumpTo} resume={resume} />
          ))}
        </ol>
        {/* room for a description under "pill above" points (dot bottom + 27px + 3 lines) */}
        <div style={{ height: DOT_TOP + DOT + DESC_GAP + 52 - BOX }} aria-hidden />
      </div>

      {/* Tablet (768–1279): one serpentine path with rounded turns. Row one holds points 1–3;
          points 4 and 5 sit centred under the gaps (4 between 2 and 3, 5 between 1 and 2). */}
      <div ref={rowsRef} className="relative hidden w-full flex-col gap-10 md:flex xl:hidden">
        {path && (
          <svg className="pointer-events-none absolute inset-0" width={path.w} height={path.h} viewBox={`0 0 ${path.w} ${path.h}`} aria-hidden>
            <path d={path.d} fill="none" stroke="var(--color-line)" strokeWidth="1" />
            <path
              d={path.d}
              fill="none"
              stroke="var(--color-dark)"
              strokeWidth="1"
              strokeDasharray={`${Math.min(progress, path.total)} 100000`}
            />
          </svg>
        )}
        {Array.from({ length: ROWS }, (_, r) => (
          <div
            key={r}
            ref={(el) => {
              rowElRefs.current[r] = el;
            }}
            className="relative w-full"
          >
            <ol className={cn("relative grid w-full gap-4", r === 0 ? "grid-cols-3" : "grid-cols-6")}>
              {stages.slice(r * PER_ROW, (r + 1) * PER_ROW).map((stage, k) => (
                <Point
                  key={stage.label}
                  stage={stage}
                  i={r * PER_ROW + k}
                  active={active}
                  setDot={setRowDot}
                  jumpTo={jumpTo}
                  resume={resume}
                  className={r === 1 ? (k === 0 ? "col-span-2 col-start-4 row-start-1" : "col-span-2 col-start-2 row-start-1") : undefined}
                />
              ))}
            </ol>
            {r === ROWS - 1 && <div style={{ height: DOT_TOP + DOT + DESC_GAP + 52 - BOX }} aria-hidden />}
          </div>
        ))}
      </div>

      {/* Phone: vertical timeline with the same sweep, active pill and tap-to-seek */}
      <ol ref={vTrackRef} className="relative flex flex-col gap-8 pl-10 md:hidden">
        <div className="absolute bottom-0 left-[8px] top-0 w-px bg-line" aria-hidden />
        <div className="absolute left-[8px] top-0 w-px bg-dark" style={{ height: Math.min(progress, width) }} aria-hidden />
        {stages.map((stage, i) => {
          const isActive = i === active;
          const passed = i <= active;
          return (
            <li key={stage.label} className="relative flex flex-col gap-3">
              <button
                type="button"
                onClick={() => jumpTo(i, false)}
                aria-label={`Go to stage: ${stage.label}`}
                aria-pressed={isActive}
                className="absolute -left-[36px] top-[10px] p-1"
              >
                <span
                  ref={(el) => {
                    vDotRefs.current[i] = el;
                  }}
                  className={cn("block rounded-full border transition-colors duration-300", passed ? "border-dark bg-dark" : "border-[#c6c6c6] bg-cream")}
                  style={{ width: DOT, height: DOT }}
                />
              </button>
              <button
                type="button"
                onClick={() => jumpTo(i, false)}
                className={cn(
                  "inline-flex w-max max-w-full rounded-[50px] border px-6 pb-[11px] pt-[9px] text-left text-[14px] font-medium leading-[1.3] tracking-[-0.04em] transition-colors duration-300",
                  isActive ? "border-dark bg-dark text-white" : "border-[#c6c6c6] text-[#1f1f1f]"
                )}
              >
                {stage.label}
              </button>
              <p
                className={cn(
                  "max-w-[420px] text-[13px] leading-[1.3] tracking-[-0.04em] text-[#2e2e2e]/80 transition-opacity duration-300",
                  isActive ? "opacity-100" : "opacity-50"
                )}
              >
                {stage.text}
              </p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

type PointProps = {
  stage: ServiceStage;
  i: number;
  active: number;
  setDot: (i: number, el: HTMLSpanElement | null) => void;
  jumpTo: (i: number, pause: boolean) => void;
  resume: () => void;
  className?: string;
};

/** One timeline point (dot, pill, description) for the horizontal layouts. */
function Point({ stage, i, active, setDot, jumpTo, resume, className }: PointProps) {
  const below = i % 2 === 1;
  const isActive = i === active;
  const passed = i <= active; // dots the line has already reached stay dark
  return (
    <li
      className={cn("relative min-w-0 flex-1", className)}
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
          ref={(el) => setDot(i, el)}
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
          "absolute left-1/2 flex w-full max-w-[220px] -translate-x-1/2 items-center justify-center whitespace-nowrap rounded-[50px] border px-4 pb-[11px] pt-[9px] text-[14px] font-medium leading-[1.3] tracking-[-0.04em] transition-colors duration-300",
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
}
