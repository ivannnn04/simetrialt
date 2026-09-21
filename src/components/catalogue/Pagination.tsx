import Link from "next/link";
import { cn } from "@/lib/cn";

type Props = {
  page: number;
  pages: number;
  /** Builds the href for a page, keeping the current filters. */
  href: (page: number) => string;
};

/** Figma "pagination" (node 4213:30257): chevrons, 13px page numbers, current in black, ellipsis. */
export function Pagination({ page, pages, href }: Props) {
  if (pages <= 1) return null;

  // 1 … around current … last, collapsing long runs into "…"
  const items: (number | "…")[] = [];
  const push = (n: number) => {
    if (items[items.length - 1] !== n) items.push(n);
  };
  for (let n = 1; n <= pages; n++) {
    if (n === 1 || n === pages || Math.abs(n - page) <= 1 || (page <= 3 && n <= 4) || (page >= pages - 2 && n >= pages - 3)) {
      push(n);
    } else if (items[items.length - 1] !== "…") {
      items.push("…");
    }
  }

  const arrow = (dir: -1 | 1, disabled: boolean) => (
    <Link
      href={href(page + dir)}
      aria-label={dir < 0 ? "Previous page" : "Next page"}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : undefined}
      className={cn("flex size-6 items-center justify-center text-black transition-colors hover:text-accent", disabled && "pointer-events-none opacity-30")}
    >
      <svg viewBox="0 0 24 24" className={cn("size-6", dir > 0 && "rotate-180")} fill="none" aria-hidden>
        <path d="M14.5 5.5 8 12l6.5 6.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </Link>
  );

  return (
    <nav aria-label="Pagination" className="flex h-[37px] w-full items-center justify-center gap-[9px]">
      {arrow(-1, page <= 1)}
      {items.map((it, i) =>
        it === "…" ? (
          <span key={`e${i}`} className="flex w-[27px] items-center justify-center p-[10px] text-[13px] leading-[1.3] tracking-[-0.04em] text-secondary">
            …
          </span>
        ) : (
          <Link
            key={it}
            href={href(it)}
            aria-current={it === page ? "page" : undefined}
            className={cn(
              "flex min-w-[27px] items-center justify-center p-[10px] text-center text-[13px] leading-[1.3] tracking-[-0.04em] transition-colors hover:text-black",
              it === page ? "text-black" : "text-secondary"
            )}
          >
            {it}
          </Link>
        )
      )}
      {arrow(1, page >= pages)}
    </nav>
  );
}
