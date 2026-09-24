"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { CaretIcon } from "@/components/ui/Icons";

export type FilterGroup = { key: string; label: string; options: { value: string; label: string }[] | string[] };

const norm = (o: { value: string; label: string } | string) => (typeof o === "string" ? { value: o, label: o } : o);

function FilterSection({ group, selected, onToggle }: { group: FilterGroup; selected: string[]; onToggle: (v: string) => void }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="flex w-full flex-col gap-[15px]">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2 text-[15px] font-semibold uppercase leading-none tracking-[-0.02em] text-[#0a0a0a]">
          <span className="size-1.5 shrink-0 rounded-full bg-[#0a0a0a]" />
          <span className="truncate whitespace-nowrap">{group.label}</span>
        </span>
        <CaretIcon className={cn("size-6 shrink-0 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="flex w-full flex-col gap-[5px]">
          {group.options.map(norm).map((opt) => {
            const active = selected.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onToggle(opt.value)}
                className={cn(
                  "w-full border p-[10px] text-left text-[14px] leading-none tracking-[-0.04em] transition-colors duration-200",
                  active ? "border-[#1f1f1f] bg-[#1f1f1f] text-white" : "border-[#e2e2e2] text-black hover:border-[#1f1f1f]"
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Figma catalogue sidebar (node 4217:47888): grouped option boxes, price range, reset. */
export function Filters({ groups, basePath = "/catalogue" }: { groups: FilterGroup[]; basePath?: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [min, setMin] = useState(params.get("min") ?? "");
  const [max, setMax] = useState(params.get("max") ?? "");

  const update = (mutate: (p: URLSearchParams) => void) => {
    const next = new URLSearchParams(params.toString());
    mutate(next);
    next.delete("page"); // any filter change starts from the first page
    router.push(`${basePath}?${next.toString()}`, { scroll: false });
  };

  const toggle = (key: string, value: string) =>
    update((p) => {
      const current = p.getAll(key);
      p.delete(key);
      const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
      next.forEach((v) => p.append(key, v));
    });

  const applyPrice = () =>
    update((p) => {
      if (min) p.set("min", min);
      else p.delete("min");
      if (max) p.set("max", max);
      else p.delete("max");
    });

  const price = (
    <div key="price" className="flex w-full flex-col gap-[15px]">
      <span className="flex items-center gap-2 text-[15px] font-semibold uppercase leading-none tracking-[-0.02em] text-[#0a0a0a]">
        <span className="size-1.5 shrink-0 rounded-full bg-[#0a0a0a]" />
        Price
      </span>
      <div className="flex items-center gap-[9px]">
        <input
          value={min}
          onChange={(e) => setMin(e.target.value)}
          onBlur={applyPrice}
          onKeyDown={(e) => e.key === "Enter" && applyPrice()}
          placeholder="€ Min"
          inputMode="numeric"
          className="min-w-0 flex-1 border border-[#ddd] bg-transparent px-[10px] py-2 text-[14px] leading-none tracking-[-0.04em] placeholder:text-black focus:outline-none"
        />
        <span className="text-[12px] text-[#8a8473]">—</span>
        <input
          value={max}
          onChange={(e) => setMax(e.target.value)}
          onBlur={applyPrice}
          onKeyDown={(e) => e.key === "Enter" && applyPrice()}
          placeholder="€ Max"
          inputMode="numeric"
          className="min-w-0 flex-1 border border-[#ddd] bg-transparent px-[10px] py-2 text-[14px] leading-none tracking-[-0.04em] placeholder:text-black focus:outline-none"
        />
      </div>
    </div>
  );

  // Figma order: Typology, Brands, Price, On display, Material (Category first when the page lists several).
  // Category is never a sidebar group: it comes from the Products menu / footer links.
  const ORDER = ["typology", "brand", "display", "material", "features"];
  const sorted = groups.filter((g) => g.key !== "category").sort((a, b) => ORDER.indexOf(a.key) - ORDER.indexOf(b.key));
  const sections: React.ReactNode[] = [];
  sorted.forEach((g) => {
    sections.push(<FilterSection key={g.key} group={g} selected={params.getAll(g.key)} onToggle={(v) => toggle(g.key, v)} />);
    if (g.key === "brand") sections.push(price);
  });
  if (!sorted.some((g) => g.key === "brand")) sections.push(price);

  return (
    <aside className="w-full lg:w-[302px] lg:shrink-0 lg:pr-10">
      {/* Figma "filters" panel (node 4217:46608): white card, 20/30px padding, 40px between groups */}
      <div className="flex w-full flex-col gap-10 bg-white px-5 py-[30px]">
        {sections}
        <button
          type="button"
          onClick={() => router.push(basePath)}
          className="w-full bg-[#e2e2e2]/50 px-8 py-[11px] text-center text-[13px] font-medium text-black transition-colors hover:bg-[#e2e2e2]"
        >
          Reset all filters
        </button>
      </div>
    </aside>
  );
}

const DEFAULT_SORTS = [
  { value: "relevance", label: "Relevance" },
  { value: "newest", label: "Newest" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "name", label: "Name" },
];

export function SortSelect({
  value,
  basePath = "/catalogue",
  options = DEFAULT_SORTS,
}: {
  value: string;
  basePath?: string;
  options?: { value: string; label: string }[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  return (
    <label className="flex items-center gap-2 text-[15px] leading-none">
      <span className="text-[#1a1c18]/60">Sort by</span>
      {/* Figma 4217:47880: value, 6px gap, 8×4 caret (native select padding and arrow removed) */}
      <span className="relative inline-block">
        {/* Invisible mirror of the selected label sizes the select to its text, so the caret follows the value. */}
        <span aria-hidden className="invisible block whitespace-nowrap pr-[14px]">
          {options.find((o) => o.value === value)?.label ?? options[0]?.label}
        </span>
        <select
          value={value}
          onChange={(e) => {
            const next = new URLSearchParams(params.toString());
            if (e.target.value === "relevance") next.delete("sort");
            else next.set("sort", e.target.value);
            next.delete("page");
            router.push(`${basePath}?${next.toString()}`, { scroll: false });
          }}
          className="absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent p-0 pr-[14px] text-[15px] leading-none text-[#1a1c18] focus:outline-none"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <svg aria-hidden viewBox="0 0 8 4" className="pointer-events-none absolute right-0 top-1/2 h-1 w-2 -translate-y-1/2 text-[#1a1c18]">
          <path d="M0 0l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1" />
        </svg>
      </span>
    </label>
  );
}
