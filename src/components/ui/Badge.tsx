import { cn } from "@/lib/cn";

/** Uppercase eyebrow label (Figma "Brand Badge"). */
export function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn("text-[16px] font-semibold uppercase leading-none tracking-[-0.04em]", className)}>{children}</p>
  );
}
