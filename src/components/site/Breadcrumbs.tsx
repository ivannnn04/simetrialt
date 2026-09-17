import Link from "next/link";

type Crumb = { label: string; href?: string };

/** Figma "Breadcrumbs": grey trail, black current item, small chevrons. */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-[15px] leading-[1.4] tracking-[-0.04em]">
      {items.map((item, i) => {
        const last = i === items.length - 1;
        return (
          <span key={item.label} className="flex items-center gap-2">
            {item.href && !last ? (
              <Link href={item.href} className="text-secondary hover:text-black">{item.label}</Link>
            ) : (
              <span className={last ? "text-black" : "text-secondary"}>{item.label}</span>
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
