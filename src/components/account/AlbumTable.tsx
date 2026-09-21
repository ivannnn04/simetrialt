"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { removeFromCollection, updateCollectionItem } from "@/actions/collections";
import { ProductCard, type ProductCardData } from "@/components/catalogue/ProductCard";
import { cn } from "@/lib/cn";

export type AlbumRow = {
  productId: string;
  name: string;
  category: string;
  /** two-line category label as in the design, e.g. ["Indoor", "lighting"] */
  categoryLines: [string, string];
  brand: string;
  priceCents: number;
  quantity: number;
  note: string;
  href: string;
  image: string | null;
  card: ProductCardData;
};

type Props = {
  collectionId: string;
  rows: AlbumRow[];
  /** sample albums are read-only: quantity / note changes stay local */
  readOnly?: boolean;
};

const eur = (cents: number) => `€${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

const SORTS = [
  { value: "category", label: "Category" },
  { value: "name", label: "Name" },
  { value: "price", label: "Price" },
  { value: "brand", label: "Brand" },
] as const;
type Sort = (typeof SORTS)[number]["value"];

function Icon({ d, className, size = 24 }: { d: string; className?: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={cn("size-6", className)} style={{ width: size, height: size }} aria-hidden>
      <path d={d} stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const MINUS = "M6 12h12";
const PLUS = "M6 12h12M12 6v12";
const CLOSE = "M7 7l10 10M17 7L7 17";
const LIST = "M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01";
const GRID = "M4 4h16v16H4zM9.5 4v16M14.5 4v16";

/** Album page body: toolbar, product table (or card grid) and the collection summary. */
export function AlbumTable({ collectionId, rows: initial, readOnly = false }: Props) {
  const [rows, setRows] = useState(initial);
  const [sort, setSort] = useState<Sort>("category");
  const [view, setView] = useState<"list" | "grid">("list");
  const [, start] = useTransition();

  const sorted = useMemo(() => {
    const list = [...rows];
    switch (sort) {
      case "name":
        return list.sort((a, b) => a.name.localeCompare(b.name));
      case "price":
        return list.sort((a, b) => a.priceCents - b.priceCents);
      case "brand":
        return list.sort((a, b) => a.brand.localeCompare(b.brand));
      default:
        return list.sort((a, b) => a.category.localeCompare(b.category));
    }
  }, [rows, sort]);

  const patch = (productId: string, p: { quantity?: number; note?: string }) => {
    setRows((rs) => rs.map((r) => (r.productId === productId ? { ...r, ...p } : r)));
    if (!readOnly) start(() => updateCollectionItem(collectionId, productId, p));
  };
  const remove = (productId: string) => {
    setRows((rs) => rs.filter((r) => r.productId !== productId));
    if (!readOnly) start(() => removeFromCollection(collectionId, productId));
  };

  const units = rows.reduce((n, r) => n + r.quantity, 0);
  const brands = new Set(rows.map((r) => r.brand).filter(Boolean)).size;
  const total = rows.reduce((n, r) => n + r.priceCents * r.quantity, 0);

  const th = "bg-[#f2f2f2] p-[10px] text-[20px] font-medium leading-[1.3] tracking-[-0.04em] text-[#1b2a41]";
  const td = "border-b border-[#ddd] py-5 align-top";
  const cell = "px-[10px] text-[18px] leading-[1.3] tracking-[-0.04em] text-[#1b2a41]";

  return (
    <div className="flex w-full flex-col gap-[45px]">
      {/* toolbar (node 4217:46945) */}
      <div className="flex flex-col gap-4 md:h-[39px] md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-6 md:gap-9">
          <p className="text-[18px] font-semibold leading-none tracking-[-0.04em] text-[#2b2b2b]">
            {rows.length} {rows.length === 1 ? "product" : "products"}
          </p>
          <label className="flex items-center gap-2 text-[15px] leading-[1.4] tracking-[-0.04em]">
            <span className="text-[#1a1c18]/60">Sort by</span>
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="bg-transparent text-[#1a1c18] focus:outline-none">
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="List view"
              aria-pressed={view === "list"}
              onClick={() => setView("list")}
              className={cn("flex size-[33px] items-center justify-center transition-colors", view === "list" ? "text-ink" : "text-tertiary hover:text-ink")}
            >
              <Icon d={LIST} size={26} />
            </button>
            <button
              type="button"
              aria-label="Grid view"
              aria-pressed={view === "grid"}
              onClick={() => setView("grid")}
              className={cn("flex size-8 items-center justify-center transition-colors", view === "grid" ? "text-ink" : "text-tertiary hover:text-ink")}
            >
              <Icon d={GRID} size={22} />
            </button>
          </div>
        </div>
        <Link
          href="/catalogue"
          className="flex h-[39px] items-center justify-center gap-[10px] bg-dark px-8 text-[13px] font-medium text-white transition-colors duration-300 hover:bg-accent"
        >
          <Icon d={PLUS} size={16} />
          Add products
        </Link>
      </div>

      <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:justify-between">
        {view === "grid" ? (
          <div className="grid flex-1 grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {sorted.map((r) => (
              <ProductCard key={r.productId} product={r.card} className="h-[420px]" />
            ))}
          </div>
        ) : (
          <div className="w-full overflow-x-auto lg:w-auto lg:flex-1">
            <table className="w-full border-separate border-spacing-0">
              <thead>
                <tr>
                  <th className={cn(th, "min-w-[300px] pl-5 text-left")}>PRODUCT</th>
                  <th className={cn(th, "w-[140px] text-left")}>CATEGORY</th>
                  <th className={cn(th, "w-[140px] text-left")}>PRICE</th>
                  <th className={cn(th, "w-[140px] text-left")}>QTY</th>
                  <th className={cn(th, "w-[140px] text-left")}>NOTES</th>
                  <th className={cn(th, "w-[140px] pr-5 text-left")}>ACTIONS</th>
                </tr>
                <tr aria-hidden>
                  <td colSpan={6} className="h-[44px]" />
                </tr>
              </thead>
              <tbody>
                {sorted.map((r) => (
                  <tr key={r.productId}>
                    <td className={cn(td, "pl-5 pr-10")}>
                      <Link href={r.href} className="group flex items-start gap-[25px]">
                        <span className="flex size-[114px] shrink-0 items-center justify-center bg-[#f2f2f2]">
                          {r.image && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={r.image} alt="" className="max-h-[60%] max-w-[80%] object-contain" />
                          )}
                        </span>
                        <span className="flex min-w-[140px] flex-col gap-3 leading-none">
                          <span className="text-[18px] font-semibold tracking-[-0.04em] text-[#1b2a41] transition-colors group-hover:text-accent">{r.name}</span>
                          <span className="text-[13px] tracking-[-0.04em] text-[#bcbcbc]">{r.category}</span>
                        </span>
                      </Link>
                    </td>
                    <td className={cn(td, cell)}>
                      <span className="block">{r.categoryLines[0]}</span>
                      <span className="block">{r.categoryLines[1]}</span>
                    </td>
                    <td className={cn(td, cell)}>
                      <span className="block">from</span>
                      <span className="block">{eur(r.priceCents)}</span>
                    </td>
                    <td className={td}>
                      <div className="flex h-[45px] items-center gap-2">
                        <button type="button" aria-label="Decrease quantity" onClick={() => patch(r.productId, { quantity: Math.max(1, r.quantity - 1) })} className="text-ink transition-colors hover:text-accent">
                          <Icon d={MINUS} />
                        </button>
                        <span className="w-[31px] p-[10px] text-center text-[18px] leading-[1.3] tracking-[-0.04em] text-[#1b2a41]">{r.quantity}</span>
                        <button type="button" aria-label="Increase quantity" onClick={() => patch(r.productId, { quantity: r.quantity + 1 })} className="text-ink transition-colors hover:text-accent">
                          <Icon d={PLUS} />
                        </button>
                      </div>
                    </td>
                    <td className={td}>
                      <input
                        defaultValue={r.note}
                        placeholder="Add a note..."
                        aria-label={`Note for ${r.name}`}
                        onBlur={(e) => e.target.value !== r.note && patch(r.productId, { note: e.target.value })}
                        className="h-[45px] w-full border border-[#ddd] bg-transparent px-[10px] text-center text-[18px] tracking-[-0.04em] text-[#1b2a41] placeholder:text-secondary focus:border-dark focus:outline-none"
                      />
                    </td>
                    <td className={cn(td, "pl-[10px] pr-5")}>
                      <div className="flex h-[45px] items-center justify-center gap-1">
                        <Link href={r.href} className="w-10 text-[18px] leading-[1.3] tracking-[-0.04em] text-[#1b2a41] transition-colors hover:text-accent">
                          View
                        </Link>
                        <button type="button" aria-label={`Remove ${r.name} from collection`} onClick={() => remove(r.productId)} className="text-ink transition-colors hover:text-[#fb3b30]">
                          <Icon d={CLOSE} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {sorted.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-10 text-[16px] tracking-[-0.04em] text-secondary">
                      This collection is empty. Save products from the catalogue with the heart icon.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Collection summary (node 4217:47106) */}
        <aside className="flex w-full shrink-0 flex-col gap-12 border border-[#ddd] px-5 py-10 lg:w-[292px]">
          <div className="flex flex-col gap-[18px]">
            <div className="flex flex-col gap-[22px] text-[#1b2a41]">
              <p className="text-[20px] font-medium leading-[1.3] tracking-[-0.04em]">Collection summary</p>
              <dl className="flex flex-col text-[18px] tracking-[-0.04em]">
                {[
                  ["Products", String(rows.length)],
                  ["Total units", String(units)],
                  ["Brands", String(brands)],
                ].map(([k, v], i) => (
                  <div key={k} className={cn("flex items-center gap-10 border-b border-[#ddd] py-[10px] leading-[1.3]", i === 0 && "border-t")}>
                    <dt className="flex-1">{k}</dt>
                    <dd className="w-[100px] text-right">{v}</dd>
                  </div>
                ))}
                <div className="flex items-center gap-10 py-[10px]">
                  <dt className="flex-1 leading-[1.3]">Indicative total</dt>
                  <dd className="whitespace-nowrap text-right font-semibold leading-none">from {eur(total)}</dd>
                </div>
              </dl>
            </div>
            <p className="text-[16px] leading-[1.3] tracking-[-0.04em] text-secondary">
              Prices are indicative and subject to confirmation. Volume discounts may apply — our team will confirm on enquiry.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <Link
              href={`/contact?collection=${encodeURIComponent(collectionId)}`}
              className="flex h-[39px] items-center justify-center bg-dark px-8 text-[13px] font-medium text-white transition-colors duration-300 hover:bg-accent"
            >
              Send as enquiry
            </Link>
            <button
              type="button"
              onClick={() => window.print()}
              className="flex h-[39px] items-center justify-center border border-dark px-8 text-[13px] font-medium text-black transition-colors duration-300 hover:bg-dark hover:text-white"
            >
              Download PDF
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}

