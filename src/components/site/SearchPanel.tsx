"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { cn } from "@/lib/cn";
import { SearchIcon } from "@/components/ui/Icons";
import { ProductSlider } from "@/components/catalogue/ProductSlider";
import type { ProductCardData } from "@/components/catalogue/ProductCard";
import { searchProducts } from "@/actions/search";

type Props = { open: boolean; onClose: () => void };

/**
 * Header search (Figma 4217:47301 / 47271 / 47286): a full-width panel under the nav bar with an
 * underlined query field; results render as a product slider, an empty query shows nothing and a
 * miss shows "No results were found for your query".
 */
export function SearchPanel({ open, onClose }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProductCardData[] | null>(null); // null = nothing searched yet
  const [pending, startTransition] = useTransition();

  // Focus the field when the panel opens; reset when it closes.
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => {
      setQuery("");
      setResults(null);
    }, 400);
    return () => clearTimeout(t);
  }, [open]);

  // Debounced search.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      const t = setTimeout(() => setResults(null), 0);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => {
      startTransition(async () => {
        const items = await searchProducts(q);
        setResults(items);
      });
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const active = query.trim().length >= 2;

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 py-6 md:p-10">
      <label
        className={cn(
          "flex items-center gap-4 border-b pb-2 transition-colors duration-300",
          active ? "border-[#57595b]" : "border-line focus-within:border-[#57595b]"
        )}
      >
        <SearchIcon className="size-6 shrink-0 text-[#57595b]" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search"
          aria-label="Search products"
          autoComplete="off"
          className="w-full bg-transparent text-[18px] font-medium leading-none tracking-[-0.04em] text-black outline-none placeholder:text-[#57595b] [&::-webkit-search-cancel-button]:hidden"
        />
      </label>

      {active && results !== null && results.length > 0 && (
        <div className={cn("transition-opacity duration-300", pending && "opacity-60")}>
          <ProductSlider
            products={results}
            title={<p className="text-[14px] leading-[1.3] tracking-[-0.04em] text-label">Search Results</p>}
          />
        </div>
      )}

      {active && results !== null && results.length === 0 && !pending && (
        <div className="flex flex-col gap-6">
          <p className="text-[14px] leading-[1.3] tracking-[-0.04em] text-label">Search Results</p>
          <p className="text-[24px] font-medium leading-[1.3] tracking-[-0.04em] text-black md:text-[30px]">
            No results were found for your query
          </p>
        </div>
      )}
    </div>
  );
}
