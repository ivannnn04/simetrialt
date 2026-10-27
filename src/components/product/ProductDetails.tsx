"use client";

import { useMemo, useState } from "react";
import { ProductGallery } from "@/components/product/ProductGallery";
import { ProductInfo } from "@/components/product/ProductInfo";
import type { ProductView } from "@/lib/product-page";

/**
 * Product page body: the gallery and the info column share the selected variant, so picking a
 * colour or another option swaps the photos, price, SKU and specification together. The URL is
 * updated to the variant's own page without a reload, so links and the back button stay exact.
 */
export function ProductDetails({ product, crumbs }: { product: ProductView; crumbs: React.ReactNode }) {
  const [selectedId, setSelectedId] = useState(product.id);
  const variant = useMemo(() => product.variants.find((v) => v.id === selectedId) ?? product.variants[0], [product.variants, selectedId]);

  const select = (axis: string, value: string) => {
    // prefer the variant that keeps every other current choice; otherwise the first with this value
    const wanted = { ...variant.attrs, [axis]: value };
    const exact = product.variants.find((v) => Object.entries(wanted).every(([k, val]) => v.attrs[k] === val));
    const next = exact ?? product.variants.find((v) => v.attrs[axis] === value);
    if (!next || next.id === variant.id) return;
    setSelectedId(next.id);
    if (typeof window !== "undefined" && !/^sample-/.test(next.slug)) window.history.replaceState(null, "", `/catalogue/${next.slug}`);
  };

  return (
    <section className="mx-auto grid w-full max-w-[1440px] gap-6 px-4 pt-[34px] md:px-10 min-[993px]:grid-cols-2 min-[993px]:gap-y-10 min-[993px]:gap-x-10 xl:gap-x-20">
      {/* Gallery column (node 4217:46872): vertical stack on desktop, slider up to 992px */}
      <div className="flex min-w-0 flex-col gap-[45px]">
        {crumbs}
        <ProductGallery key={variant.id} images={variant.images} name={`${product.name} ${variant.label}`.trim()} />
      </div>

      {/* Info column (node 4217:46881) */}
      <div className="min-[993px]:sticky min-[993px]:top-0 min-[993px]:self-start">
        <ProductInfo product={product} variant={variant} onSelect={select} />
      </div>
    </section>
  );
}
