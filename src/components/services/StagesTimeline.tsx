"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import type { ServiceStage } from "@/data/services";

/**
 * Figma "how we work" (node 4048:30522): a horizontal line with five points; pills alternate
 * above and below the line, the active point shows its description. Hover/click activates.
 */
export function StagesTimeline({ stages }: { stages: ServiceStage[] }) {
  const [active, setActive] = useState(0);

  return (
    <div className="w-full">
      {/* Desktop: line + alternating points */}
      <div className="relative hidden w-full xl:block">
        <div className="absolute left-0 right-0 top-[62px] h-px bg-line" aria-hidden />
        <ol className="mx-auto flex w-max items-start gap-[58px]">
          {stages.map((stage, i) => {
            const below = i % 2 === 1;
            const isActive = i === active;
            const dot = (
              <span
                className={cn(
                  "block size-[18px] rounded-full border transition-colors duration-300",
                  isActive ? "border-dark bg-dark" : "border-[#c6c6c6] bg-cream"
                )}
              />
            );
            const pill = (
              <span
                className={cn(
                  "flex w-[220px] whitespace-nowrap items-center justify-center rounded-[50px] border px-6 pb-[11px] pt-[9px] text-[14px] font-medium leading-[1.3] tracking-[-0.04em] transition-colors duration-300",
                  isActive ? "border-dark bg-dark text-white" : "border-[#c6c6c6] text-[#1f1f1f] hover:border-dark"
                )}
              >
                {stage.label}
              </span>
            );
            return (
              <li key={stage.label} className="flex w-[225px] flex-col items-start">
                {/* 150px box; the dot is always centred on the line (y = 62px), pills sit above or below it */}
                <button
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  onClick={() => setActive(i)}
                  aria-pressed={isActive}
                  className="relative flex h-[150px] w-full justify-center"
                >
                  <span className="absolute left-1/2 top-[53px] -translate-x-1/2">{dot}</span>
                  <span className={cn("absolute left-1/2 -translate-x-1/2", below ? "top-[83px]" : "bottom-[calc(100%-50px)]")}>{pill}</span>
                </button>
                <p
                  className={cn(
                    "w-full text-[13px] leading-[1.3] tracking-[-0.04em] text-[#2e2e2e]/80 transition-opacity duration-300",
                    isActive ? "opacity-100" : "opacity-0"
                  )}
                  aria-hidden={!isActive}
                >
                  {stage.text}
                </p>
              </li>
            );
          })}
        </ol>
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
