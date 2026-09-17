import Link from "next/link";
import { cn } from "@/lib/cn";

type Variant = "dark" | "light" | "outline-light" | "outline-dark";

const styles: Record<Variant, { box: string; dot: string | null }> = {
  dark: { box: "bg-dark text-white hover:bg-ink", dot: "bg-white" },
  light: { box: "bg-white text-ink hover:bg-cream", dot: "bg-ink" },
  "outline-light": { box: "border border-line text-white hover:bg-white/10", dot: null },
  "outline-dark": { box: "border border-line text-ink hover:bg-white", dot: null },
};

type Props = {
  variant?: Variant;
  href?: string;
  className?: string;
  children: React.ReactNode;
  type?: "button" | "submit";
  onClick?: () => void;
};

/** Figma "Button" component: 24×16 padding, 14px semibold label with 6px square dots. */
export function DotButton({ variant = "dark", href, className, children, type = "button", onClick }: Props) {
  const s = styles[variant];
  const cls = cn(
    "inline-flex items-center justify-center gap-3 px-6 py-4 text-[14px] font-semibold leading-none tracking-[-0.03em] whitespace-nowrap transition-colors",
    s.box,
    className
  );
  const inner = (
    <>
      {s.dot && <span className={cn("size-[6px] shrink-0", s.dot)} />}
      <span>{children}</span>
      {s.dot && <span className={cn("size-[6px] shrink-0", s.dot)} />}
    </>
  );
  if (href) {
    return (
      <Link href={href} className={cls}>
        {inner}
      </Link>
    );
  }
  return (
    <button type={type} onClick={onClick} className={cls}>
      {inner}
    </button>
  );
}
