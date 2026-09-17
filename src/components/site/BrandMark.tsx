import { cn } from "@/lib/cn";
import type { Brand } from "@/data/brands";

/** Typographic wordmark used until real brand logo files are available. */
export function BrandMark({ brand, className }: { brand: Brand; className?: string }) {
  return (
    <span className={cn("block leading-none text-current", brand.mark?.className ?? "font-semibold text-[32px]", className)}>
      {brand.mark?.text ?? brand.name}
    </span>
  );
}
