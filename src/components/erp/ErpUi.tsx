import Link from "next/link";
import { cn } from "@/lib/cn";
import { statusDef } from "@/lib/erp/config";
import { eur } from "@/lib/erp/money";

export function StatusBadge({ type, status }: { type: string; status: string }) {
  return <span className={cn("inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium", statusDef(type, status).color)}>{status}</span>;
}

export function Kpi({ label, value, sub, href, tone }: { label: string; value: string; sub?: string; href?: string; tone?: "up" | "down" }) {
  const body = (
    <div className="h-full rounded-xl bg-white p-4 shadow-sm transition-shadow hover:shadow">
      <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1 whitespace-nowrap text-xl font-semibold tabular-nums xl:text-2xl">{value}</p>
      {sub && <p className={cn("mt-1 text-xs", tone === "up" ? "text-green-700" : tone === "down" ? "text-red-600" : "text-zinc-500")}>{sub}</p>}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export const Money = ({ cents, className }: { cents: number; className?: string }) => <span className={cn("tabular-nums", cents < 0 && "text-red-600", className)}>{eur(cents)}</span>;

export function Th({ children, right }: { children?: React.ReactNode; right?: boolean }) {
  return <th className={cn("whitespace-nowrap px-3 py-2 text-xs font-medium uppercase tracking-wide text-zinc-500", right ? "text-right" : "text-left")}>{children}</th>;
}

export function Td({ children, right, className }: { children?: React.ReactNode; right?: boolean; className?: string }) {
  return <td className={cn("px-3 py-2 align-top", right && "text-right tabular-nums", className)}>{children}</td>;
}

/** Simple horizontal bar for charts drawn with CSS. */
export function Bar({ value, max, className }: { value: number; max: number; className?: string }) {
  return (
    <div className="h-2 w-full rounded bg-zinc-100">
      <div className={cn("h-2 rounded", className ?? "bg-zinc-800")} style={{ width: `${max > 0 ? Math.max(1, Math.min(100, (value / max) * 100)) : 0}%` }} />
    </div>
  );
}
