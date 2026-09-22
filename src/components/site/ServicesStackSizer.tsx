"use client";

import { useEffect } from "react";

type Props = { start: number; step: number; count: number };

/**
 * Mobile services stack: pinned cards get a min-height so their bottoms line up with the last
 * card's bottom. That way the assembled stack scrolls away together once the last card has
 * landed, instead of the pinned cards lingering behind it. Desktop uses fixed CSS variables.
 */
export function ServicesStackSizer({ start, step, count }: Props) {
  useEffect(() => {
    const section = document.getElementById("services");
    if (!section) return;
    const cards = Array.from(section.querySelectorAll<HTMLElement>("article"));
    const last = cards[count - 1];
    if (!last) return;
    const mobile = window.matchMedia("(max-width: 63.99rem)");

    const size = () => {
      const lastTop = start + (count - 1) * step;
      cards.forEach((card, i) => {
        if (i === count - 1) return;
        if (mobile.matches) {
          // last card keeps its natural height; earlier cards stretch to its bottom edge
          const bottom = lastTop + last.offsetHeight;
          card.style.minHeight = `${bottom - (start + i * step)}px`;
        } else {
          card.style.minHeight = "";
        }
      });
    };
    size();
    const ro = new ResizeObserver(size);
    ro.observe(last);
    mobile.addEventListener("change", size);
    return () => {
      ro.disconnect();
      mobile.removeEventListener("change", size);
    };
  }, [start, step, count]);
  return null;
}
