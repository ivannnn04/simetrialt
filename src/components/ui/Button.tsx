import Link from "next/link";
import { cn } from "@/lib/cn";
import { ArrowIcon } from "@/components/ui/Icons";

/**
 * Figma design system "Button" (node 4014:6521).
 *  primary   — white surface, dark label; hover dark, pressed #393939, disabled #909090
 *  secondary — dark surface, white label; hover accent, pressed #393939, disabled #909090
 *  ghost     — outlined; hover fills dark, pressed #393939, disabled grey label
 *  ghost-light — ghost on dark photography (white label by default)
 */
export type ButtonVariant = "primary" | "secondary" | "ghost" | "ghost-light";
export type ButtonSize = "medium" | "small";

const base =
  "group/btn inline-flex items-center justify-center gap-3 text-[14px] font-semibold leading-none tracking-[-0.03em] whitespace-nowrap transition-colors select-none";

const sizes: Record<ButtonSize, string> = {
  medium: "px-6 py-4",
  small: "px-[18px] py-[10px]",
};

const variants: Record<ButtonVariant, { box: string; dot: string; disabledBox: string; disabledDot: string }> = {
  primary: {
    box: "bg-white text-ink hover:bg-dark hover:text-white active:bg-[#393939] active:text-white",
    dot: "bg-ink group-hover/btn:bg-white group-active/btn:bg-white",
    disabledBox: "bg-[#909090] text-tertiary",
    disabledDot: "bg-tertiary",
  },
  secondary: {
    box: "bg-dark text-white hover:bg-accent active:bg-[#393939]",
    dot: "bg-white",
    disabledBox: "bg-[#909090] text-tertiary",
    disabledDot: "bg-tertiary",
  },
  ghost: {
    box: "border border-line text-ink hover:border-dark hover:bg-dark hover:text-white active:border-[#393939] active:bg-[#393939] active:text-white",
    dot: "bg-ink group-hover/btn:bg-white group-active/btn:bg-white",
    disabledBox: "border border-line text-tertiary",
    disabledDot: "bg-tertiary",
  },
  "ghost-light": {
    box: "border border-line text-white hover:border-dark hover:bg-dark active:border-[#393939] active:bg-[#393939]",
    dot: "bg-white",
    disabledBox: "border border-line text-tertiary",
    disabledDot: "bg-tertiary",
  },
};

type Props = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Square dots on both sides of the label (design default: on). */
  dots?: boolean;
  disabled?: boolean;
  href?: string;
  className?: string;
  children: React.ReactNode;
  type?: "button" | "submit";
  onClick?: () => void;
};

export function DotButton({
  variant = "secondary",
  size = "medium",
  dots = true,
  disabled = false,
  href,
  className,
  children,
  type = "button",
  onClick,
}: Props) {
  const v = variants[variant];
  const cls = cn(base, sizes[size], disabled ? cn(v.disabledBox, "cursor-not-allowed") : v.box, className);
  const dotCls = cn("shrink-0 transition-colors", size === "medium" ? "size-[6px]" : "size-[5px]", disabled ? v.disabledDot : v.dot);
  const inner = (
    <>
      {dots && <span className={dotCls} />}
      <span>{children}</span>
      {dots && <span className={dotCls} />}
    </>
  );
  if (href && !disabled) {
    return (
      <Link href={href} className={cls}>
        {inner}
      </Link>
    );
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={cls}>
      {inner}
    </button>
  );
}

/** Figma "button stroke" (node 4103:16398): underlined 18px label with arrow; hover accent, disabled grey. */
export function StrokeLink({
  href,
  children,
  disabled,
  className,
}: {
  href: string;
  children: React.ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  const cls = cn(
    "inline-flex h-[27px] items-center gap-2 border-b pb-1.5 text-[18px] font-medium leading-none tracking-[-0.04em] transition-colors",
    disabled ? "cursor-not-allowed border-tertiary text-tertiary" : "border-black text-black hover:border-accent hover:text-accent",
    className
  );
  const inner = (
    <>
      {children}
      <ArrowIcon className="size-5" />
    </>
  );
  return disabled ? <span className={cls}>{inner}</span> : <Link href={href} className={cls}>{inner}</Link>;
}

/** Figma "Button back" (node 4103:16393): arrow-left + 14px label on dark; hover grey. */
export function BackLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <Link
      href={href}
      className={cn("inline-flex items-center gap-2 text-[14px] leading-[1.3] tracking-[-0.04em] text-white transition-colors hover:text-tertiary", className)}
    >
      <ArrowIcon className="size-[18px] rotate-180" />
      {children}
    </Link>
  );
}
