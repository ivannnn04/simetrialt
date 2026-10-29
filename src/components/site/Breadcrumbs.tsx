import Link from "@/components/ui/Link";
import { cn } from "@/lib/cn";

type Crumb = { label: string; href?: string };

/**
 * Figma "Breadcrumbs" (4068:10001) / "Link Breadcrumb" (4068:9949): grey trail, black current item, hover accent.
 * `highlight` marks one item in the brand red (product page: the category the product belongs to).
 */
export function Breadcrumbs({ items, highlight }: { items: Crumb[]; highlight?: number }) {
  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px] leading-[1.4] tracking-[-0.04em]">
      {items.map((item, i) => {
        const last = i === items.length - 1;
        return (
          <span key={item.label} className="flex items-center gap-2 whitespace-nowrap">
            {item.href && !last ? (
              <Link href={item.href} className={cn("transition-colors duration-300", i === highlight ? "text-brand hover:opacity-80" : "text-secondary hover:text-accent")}>{item.label}</Link>
            ) : (
              <span className={last ? "text-black" : "text-secondary"} aria-current={last ? "page" : undefined}>{item.label}</span>
            )}
            {!last && (
              <svg viewBox="0 0 6 9" className="h-[9px] w-[6px] text-secondary" fill="none" aria-hidden>
                <path d="M1 1l3.5 3.5L1 8" stroke="currentColor" strokeWidth="1" />
              </svg>
            )}
          </span>
        );
      })}
    </nav>
  );
}
