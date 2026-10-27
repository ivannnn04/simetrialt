"use client";

import { useState } from "react";
import Link from "@/components/ui/Link";
import { cn } from "@/lib/cn";
import { useT } from "@/i18n/client";
import { term } from "@/i18n/dictionaries";
import { SaveButton } from "@/components/catalogue/SaveButton";
import type { ProductVariant, ProductView } from "@/lib/product-page";

function MinusIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={cn("size-6", className)} aria-hidden>
      <path d="M6 12h12" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={cn("size-6", className)} aria-hidden>
      <path d="M6 12h12M12 6v12" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  );
}

type Props = {
  product: ProductView;
  /** the variant currently shown (photos, price, SKU, details follow it) */
  variant: ProductVariant;
  onSelect: (axis: string, value: string) => void;
};

/** Right column of the Figma "Product page" (node 4217:46881): title, price, options, quantity, actions, details. */
export function ProductInfo({ product, variant, onSelect }: Props) {
  const t = useT();
  const p = t.product;
  const [qty, setQty] = useState(1);
  const [openDetail, setOpenDetail] = useState<number | null>(0);
  const [added, setAdded] = useState(false);

  const price = variant.price;
  const details = variant.details.length ? variant.details : product.details;
  /** photo swatches only make sense when the variants actually have different photos */
  const distinctPhotos = new Set(product.variants.map((v) => v.image ?? "")).size > 1;
  /** a swatch shows the photo of the variant that has this value (keeping the other choices where possible) */
  const swatchFor = (axis: string, value: string) => {
    const wanted = { ...variant.attrs, [axis]: value };
    const exact = product.variants.find((v) => Object.entries(wanted).every(([k, val]) => v.attrs[k] === val));
    return (exact ?? product.variants.find((v) => v.attrs[axis] === value))?.image ?? null;
  };

  return (
    <div className="flex w-full flex-col gap-11 py-10">
      <div className="flex w-full flex-col gap-9">
        <div className="flex w-full flex-col gap-8">
          <div className="flex w-full flex-col gap-8">
            <div className="flex w-full flex-col gap-4">
              <div className="flex w-full flex-col gap-1">
                <p className="text-[16px] leading-[1.3] tracking-[-0.04em] text-[#2b2b2b]">{product.brand}</p>
                <div className="flex w-full items-center justify-between gap-4">
                  <h1 className="text-[36px] leading-none tracking-[-0.04em] text-black">{product.name}</h1>
                  <SaveButton
                    productId={variant.id}
                    product={{
                      id: variant.id,
                      name: `${product.name}${variant.label && product.variants.length > 1 ? ` – ${variant.label}` : ""}`,
                      category: product.typology ?? product.category?.name ?? "",
                      brand: product.brand,
                      price: variant.price,
                      salePrice: null,
                      priceCents: variant.priceCents,
                      image: variant.image ?? null,
                      href: `/catalogue/${variant.slug}`,
                    }}
                    className="shrink-0 [&>button]:size-7 [&_svg]:size-7 md:[&>button]:size-9 md:[&_svg]:size-9"
                  />
                </div>
              </div>
              <p className="flex items-baseline gap-3 text-[24px] leading-[1.3] tracking-[-0.04em] text-black">
                {price}
                {variant.oldPrice && <span className="text-[16px] text-secondary line-through">{variant.oldPrice}</span>}
              </p>
              {variant.sku && <p className="text-[13px] leading-[1.3] tracking-[-0.04em] text-secondary">SKU {variant.sku}</p>}
            </div>
            <p className="max-w-[448px] whitespace-pre-line text-[16px] leading-[1.3] tracking-[-0.04em] text-[#2b2b2b]">{variant.description}</p>
          </div>

          {product.axes.length > 0 && (
            <div className="flex w-full max-w-[448px] flex-col gap-7">
              {product.axes.map((axis) => (
                <div key={axis.key} className="flex flex-col gap-3">
                  <p className="text-[16px] uppercase leading-[1.3] tracking-[-0.04em] text-[#2b2b2b]">
                    {term(t, axis.key)}: <span className="normal-case">{variant.attrs[axis.key] ?? "—"}</span>
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    {axis.values.map((value) => {
                      const active = variant.attrs[axis.key] === value;
                      const swatch = axis.key === "Colour" && distinctPhotos ? swatchFor(axis.key, value) : null;
                      return swatch ? (
                        <button
                          key={value}
                          type="button"
                          title={value}
                          aria-label={value}
                          aria-pressed={active}
                          onClick={() => onSelect(axis.key, value)}
                          className={cn(
                            "flex h-[81px] w-[61px] items-center justify-center bg-[#f2f2f2] p-2 transition-[border-color,filter] duration-300",
                            "border-b-2",
                            active ? "border-dark" : "border-transparent hover:border-line"
                          )}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={swatch} alt="" className="size-full object-contain" />
                        </button>
                      ) : (
                        <button
                          key={value}
                          type="button"
                          aria-pressed={active}
                          onClick={() => onSelect(axis.key, value)}
                          className={cn(
                            "flex items-center justify-center border p-[10px] text-[14px] leading-none tracking-[-0.04em] transition-colors duration-300",
                            active ? "border-[#1f1f1f] bg-[#1f1f1f] text-white" : "border-[#e2e2e2] text-black hover:border-dark"
                          )}
                        >
                          {value}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex h-[45px] items-center gap-2">
            <button
              type="button"
              aria-label={p.decrease}
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              className="flex size-6 items-center justify-center text-ink transition-colors hover:text-accent"
            >
              <MinusIcon />
            </button>
            <p className="w-[31px] p-[10px] text-center text-[18px] leading-[1.3] tracking-[-0.04em] text-[#1b2a41]" aria-live="polite">
              {qty}
            </p>
            <button
              type="button"
              aria-label={p.increase}
              onClick={() => setQty((q) => q + 1)}
              className="flex size-6 items-center justify-center text-ink transition-colors hover:text-accent"
            >
              <PlusIcon />
            </button>
          </div>
        </div>

        <div className="flex w-full items-center gap-3">
          <button
            type="button"
            onClick={() => setAdded(true)}
            className={cn(
              "flex h-[39px] flex-1 items-center justify-center border border-dark px-8 py-[11px] text-[13px] font-medium text-black transition-colors duration-300 hover:bg-dark hover:text-white",
              added && "bg-dark text-white"
            )}
          >
            {added ? p.added : p.addToCart}
          </button>
          <Link
            href={`/contact?product=${encodeURIComponent(variant.sku ? `${product.name} (${variant.sku})` : product.name)}`}
            className="flex h-[39px] flex-1 items-center justify-center bg-dark px-8 py-[11px] text-[14px] font-semibold leading-none tracking-[-0.04em] text-white transition-colors duration-300 hover:bg-accent"
          >
            {p.inquire}
          </Link>
        </div>
      </div>

      {/* Details accordion (node 4217:46921): first row open by default */}
      <div className="flex w-full max-w-[504px] flex-col">
        {details.map((d, i) => {
          const open = openDetail === i;
          return (
            <div key={d.title} className="border-b border-[#ddd]">
              <button
                type="button"
                aria-expanded={open}
                onClick={() => setOpenDetail(open ? null : i)}
                className="group flex w-full items-center justify-between py-2 text-left text-[16px] leading-[1.3] tracking-[-0.04em] text-[#2b2b2b] transition-colors hover:text-accent"
              >
                {term(t, d.title)}
                <span className="relative size-6 shrink-0">
                  <span
                    className={cn(
                      "absolute left-1/2 top-1/2 h-px w-3 -translate-x-1/2 -translate-y-1/2 bg-current"
                    )}
                  />
                  <span
                    className={cn(
                      "absolute left-1/2 top-1/2 h-px w-3 -translate-x-1/2 -translate-y-1/2 bg-current transition-transform duration-300",
                      open ? "rotate-0" : "rotate-90"
                    )}
                  />
                </span>
              </button>
              <div
                className="grid transition-[grid-template-rows] duration-300 ease-out"
                style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
              >
                <div className="overflow-hidden">
                  <p className="max-w-[351px] whitespace-pre-line pb-4 text-[14px] leading-[1.3] tracking-[-0.04em] text-[#2b2b2b]">{d.body}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
