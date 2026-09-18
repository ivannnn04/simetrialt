"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Figma "View Project Circle" (node 4103:17239): a 100px frosted circle with a label that
 * follows the pointer over any element carrying `data-cursor="…"`. The native cursor is
 * hidden there (see globals.css). Only active for fine pointers (mouse / trackpad).
 */
export function CursorLabel() {
  const ref = useRef<HTMLDivElement>(null);
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    const el = ref.current;
    if (!el) return;

    let x = 0;
    let y = 0;
    let cx = 0;
    let cy = 0;
    let raf = 0;
    let visible = false;

    const render = () => {
      // ease towards the pointer for a soft, weighted feel
      cx += (x - cx) * 0.18;
      cy += (y - cy) * 0.18;
      el.style.transform = `translate3d(${cx}px, ${cy}px, 0) translate(-50%, -50%) scale(${visible ? 1 : 0.6})`;
      el.style.opacity = visible ? "1" : "0";
      if (visible || Math.abs(x - cx) > 0.5 || Math.abs(y - cy) > 0.5) raf = requestAnimationFrame(render);
      else raf = 0;
    };
    const kick = () => {
      if (!raf) raf = requestAnimationFrame(render);
    };

    const onMove = (e: PointerEvent) => {
      x = e.clientX;
      y = e.clientY;
      const target = (e.target as Element | null)?.closest<HTMLElement>("[data-cursor]");
      const next = target?.dataset.cursor ?? null;
      if (next !== null && !visible) {
        // first appearance: start at the pointer instead of sliding in from the last spot
        cx = x;
        cy = y;
      }
      visible = next !== null;
      setLabel((prev) => (prev === next ? prev : next));
      kick();
    };
    const onLeave = () => {
      visible = false;
      setLabel(null);
      kick();
    };

    document.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    window.addEventListener("blur", onLeave);
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("blur", onLeave);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 z-[100] flex size-[100px] items-center justify-center rounded-full bg-white/20 text-center text-[14px] leading-[1.3] tracking-[-0.04em] text-white opacity-0 backdrop-blur-[6px] transition-opacity duration-200 will-change-transform"
    >
      {label}
    </div>
  );
}
