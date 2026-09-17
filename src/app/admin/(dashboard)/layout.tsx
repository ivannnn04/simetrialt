import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { logoutAction } from "@/actions/auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const nav = [
    { href: "/admin", label: "Apžvalga" },
    { href: "/admin/pages", label: "Puslapiai (CMS)" },
    { href: "/admin/products", label: "Katalogas" },
    { href: "/admin/leads", label: "Užklausos (CRM)" },
  ];
  return (
    <div className="flex min-h-screen bg-zinc-100">
      <aside className="flex w-60 shrink-0 flex-col border-r border-zinc-200 bg-white">
        <div className="border-b border-zinc-200 p-4">
          <p className="font-semibold">Simetria LT</p>
          <p className="text-xs text-zinc-500">{user.email}</p>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-md px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-zinc-200 p-3">
          <Link
            href="/"
            className="block rounded-md px-3 py-2 text-sm text-zinc-500 hover:bg-zinc-100"
          >
            ← Į svetainę
          </Link>
          <form action={logoutAction}>
            <button className="w-full rounded-md px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50">
              Atsijungti
            </button>
          </form>
        </div>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
