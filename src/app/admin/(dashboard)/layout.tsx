import Link from "next/link";
import { requireUser, ROLE_LABELS, type Role } from "@/lib/auth";
import { logoutAction } from "@/actions/auth";
import { dbStatus } from "@/lib/db";
import { SetupNotice } from "@/components/admin/SetupNotice";

const GROUPS: { title: string; items: { href: string; label: string; roles?: string[] }[] }[] = [
  {
    title: "Svetainė",
    items: [
      { href: "/admin", label: "Apžvalga" },
      { href: "/admin/content", label: "Tekstai (EN / LT)" },
      { href: "/admin/projects", label: "Projektai" },
      { href: "/admin/site-images", label: "Svetainės nuotraukos" },
      { href: "/admin/brands", label: "Prekių ženklai" },
      { href: "/admin/settings", label: "Kontaktai ir nustatymai" },
      { href: "/admin/pages", label: "Papildomi puslapiai" },
    ],
  },
  {
    title: "Katalogas",
    items: [
      { href: "/admin/showroom", label: "Katalogas klientams" },
      { href: "/admin/products", label: "Produktai ir kategorijos" },
      { href: "/admin/products/import", label: "Importas iš katalogų" },
    ],
  },
  {
    title: "Klientai",
    items: [
      { href: "/admin/leads", label: "Užklausos (CRM)" },
      { href: "/admin/quotes", label: "Pasiūlymai" },
      { href: "/admin/customers", label: "Registruoti klientai", roles: ["ADMIN"] },
    ],
  },
  {
    title: "ERP (Scoro pakaitalas)",
    items: [
      { href: "/admin/erp", label: "Apžvalga", roles: ["ADMIN", "EDITOR"] },
      { href: "/admin/erp/offers", label: "Pasiūlymai ir užsakymai", roles: ["ADMIN", "EDITOR"] },
      { href: "/admin/erp/invoices", label: "Sąskaitos", roles: ["ADMIN", "EDITOR"] },
      { href: "/admin/erp/stock", label: "Sandėlis", roles: ["ADMIN", "EDITOR"] },
      { href: "/admin/erp/calendar", label: "Kalendorius", roles: ["ADMIN", "EDITOR"] },
    ],
  },
  {
    title: "Sistema",
    items: [
      { href: "/admin/users", label: "Vartotojai ir slaptažodžiai", roles: ["ADMIN"] },
      { href: "/admin/scoro", label: "Scoro CRM", roles: ["ADMIN"] },
    ],
  },
];

/** A showroom manager sees the client catalogue and the quotes; editors everything but user management; the admin everything. */
function navFor(role: string) {
  if (role === "SHOWROOM") return [{ title: "Salonas", items: [{ href: "/admin/showroom", label: "Katalogas klientams" }, { href: "/admin/quotes", label: "Pasiūlymai" }] }];
  return GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => !i.roles || i.roles.includes(role)) })).filter((g) => g.items.length);
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const status = await dbStatus();
  if (!status.ok || !process.env.SESSION_SECRET) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-100 px-4 py-10">
        <SetupNotice status={status} />
      </main>
    );
  }
  const user = await requireUser();
  return (
    <div className="flex min-h-screen bg-zinc-100 text-zinc-900">
      <aside className="flex w-64 shrink-0 flex-col border-r border-zinc-200 bg-white">
        <div className="border-b border-zinc-200 p-4">
          <p className="notranslate text-lg font-semibold tracking-tight" translate="no">Simetria</p>
          <p className="text-xs text-zinc-500">{ROLE_LABELS[user.role as Role] ?? "Administravimas"} · {user.email}</p>
        </div>
        <nav className="flex-1 space-y-5 p-3">
          {navFor(user.role).map((g) => (
            <div key={g.title}>
              <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">{g.title}</p>
              {g.items.map((item) => (
                <Link key={item.href} href={item.href} className="block rounded-md px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100">
                  {item.label}
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <div className="border-t border-zinc-200 p-3">
          <Link href="/" target="_blank" className="block rounded-md px-3 py-2 text-sm text-zinc-500 hover:bg-zinc-100">
            ↗ Atidaryti svetainę
          </Link>
          <form action={logoutAction}>
            <button className="w-full rounded-md px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50">Atsijungti</button>
          </form>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-8">{children}</main>
    </div>
  );
}
