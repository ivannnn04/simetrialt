"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const TABS = [
  ["/admin/erp", "Apžvalga"],
  ["/admin/erp/offers", "Pasiūlymai"],
  ["/admin/erp/orders", "Užsakymai"],
  ["/admin/erp/purchase-orders", "Pirkimo užsakymai"],
  ["/admin/erp/invoices", "Sąskaitos"],
  ["/admin/erp/purchase-invoices", "Pirkimo sąskaitos"],
  ["/admin/erp/contacts", "Kontaktai"],
  ["/admin/erp/stock", "Sandėlis"],
  ["/admin/erp/commissions", "Architektų komisiniai"],
  ["/admin/erp/calendar", "Kalendorius"],
  ["/admin/erp/reports", "Ataskaitos"],
  ["/admin/erp/settings", "Nustatymai"],
] as const;

export function ErpTabs() {
  const path = usePathname();
  return (
    <nav className="-mx-1 mb-6 flex flex-wrap gap-1 border-b border-zinc-200 pb-2">
      {TABS.map(([href, label]) => {
        const active = href === "/admin/erp" ? path === href : path.startsWith(href);
        return (
          <Link key={href} href={href} className={cn("rounded-md px-3 py-1.5 text-sm", active ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100")}>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
