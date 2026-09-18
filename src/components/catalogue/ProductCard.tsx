import Link from "next/link";
import { cn } from "@/lib/cn";
import { SaveButton } from "@/components/catalogue/SaveButton";
import { PLACEHOLDER_IMAGE } from "@/lib/placeholder";

export type ProductCardData = {
  id: string;
  name: string;
  category: string;
  price: string;
  salePrice?: string | null;
  discount?: number | null;
  href: string;
  image?: string | null;
};

type Props = { product: ProductCardData; className?: string; imageClassName?: string };

/** Figma "product card": light panel, name/category top-left, heart top-right, price bottom-left. */
export function ProductCard({ product, className, imageClassName }: Props) {
  const onSale = Boolean(product.salePrice);
  const image = product.image ?? PLACEHOLDER_IMAGE;
  const isPlaceholder = !product.image;
  return (
    <div className={cn("group relative flex flex-col justify-between overflow-hidden bg-[#f2f2f2] p-4", className)}>
      <Link href={product.href} className="absolute inset-0" aria-label={product.name} />
      {image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image}
          alt=""
          className={cn(
            "pointer-events-none absolute",
            isPlaceholder ? "inset-0 size-full object-cover opacity-90" : "inset-0 m-auto max-h-[62%] max-w-[85%] object-contain",
            imageClassName
          )}
        />
      )}
      <span aria-hidden className="pointer-events-none absolute inset-0 bg-black/0 transition-colors duration-300 group-hover:bg-black/10" />
      <div className="pointer-events-none relative flex items-start justify-between">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-[5px] leading-none">
            <p className="text-[14px] tracking-[-0.04em] text-black">{product.name}</p>
            <p className="text-[13px] tracking-[-0.04em] text-tertiary">{product.category}</p>
          </div>
          {onSale && product.discount ? (
            <span className="w-fit border border-[#fb3b30] px-2 py-1 text-[14px] leading-[1.3] tracking-[-0.04em] text-[#fb3b30]">
              {product.discount}% off
            </span>
          ) : null}
        </div>
        <SaveButton productId={product.id} className="pointer-events-auto" />
      </div>
      <div className="pointer-events-none relative flex items-center gap-1.5">
        {onSale ? (
          <>
            <span className="text-[13px] font-light leading-none text-secondary line-through">{product.price}</span>
            <span className="text-[16px] leading-[1.3] tracking-[-0.04em] text-[#fb3b30]">{product.salePrice}</span>
          </>
        ) : (
          <span className="text-[16px] leading-[1.3] tracking-[-0.04em] text-black">{product.price}</span>
        )}
      </div>
    </div>
  );
}
