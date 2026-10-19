import Link from "next/link";
import { db } from "@/lib/db";
import { getBrands, getProjects } from "@/lib/site-content";
import { Card, PageTitle } from "@/components/admin/ui";

export default async function AdminDashboard() {
  const [pages, products, leads, newLeads, users, projects, brands, recent] = await Promise.all([
    db.page.count(),
    db.product.count(),
    db.lead.count(),
    db.lead.count({ where: { status: "NEW" } }),
    db.user.count(),
    getProjects(),
    getBrands(),
    db.lead.findMany({ orderBy: { createdAt: "desc" }, take: 5 }),
  ]);
  const cards = [
    { label: "Naujos užklausos", value: newLeads, href: "/admin/leads?status=NEW" },
    { label: "Visos užklausos", value: leads, href: "/admin/leads" },
    { label: "Produktai", value: products, href: "/admin/products" },
    { label: "Projektai", value: projects.length, href: "/admin/projects" },
    { label: "Prekių ženklai", value: brands.length, href: "/admin/brands" },
    { label: "Papildomi puslapiai", value: pages, href: "/admin/pages" },
    { label: "Vartotojai", value: users, href: "/admin/users" },
  ];
  const shortcuts = [
    { href: "/admin/content/home?locale=lt", label: "Redaguoti pagrindinio puslapio tekstus (LT)" },
    { href: "/admin/content/home?locale=en", label: "Redaguoti pagrindinio puslapio tekstus (EN)" },
    { href: "/admin/projects/new", label: "Pridėti projektą" },
    { href: "/admin/products/new", label: "Pridėti produktą" },
    { href: "/admin/settings", label: "Keisti telefoną, el. paštą, socialinius tinklus" },
  ];
  return (
    <div className="space-y-8">
      <PageTitle>Apžvalga</PageTitle>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((c) => (
          <Link key={c.label} href={c.href} className="rounded-xl bg-white p-5 shadow-sm hover:shadow">
            <p className="text-sm text-zinc-500">{c.label}</p>
            <p className="text-3xl font-semibold">{c.value}</p>
          </Link>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Greiti veiksmai">
          <ul className="space-y-1">
            {shortcuts.map((s) => (
              <li key={s.href}>
                <Link href={s.href} className="block rounded-md px-3 py-2 text-sm hover:bg-zinc-50">
                  → {s.label}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Naujausios užklausos">
          {recent.length === 0 && <p className="text-sm text-zinc-500">Užklausų dar nėra.</p>}
          {recent.map((lead) => (
            <Link
              key={lead.id}
              href={`/admin/leads/${lead.id}`}
              className="flex items-center justify-between border-b border-zinc-100 py-3 text-sm last:border-0 hover:bg-zinc-50"
            >
              <span className="font-medium">{lead.name}</span>
              <span className="text-zinc-500">{lead.createdAt.toLocaleDateString("lt-LT")}</span>
            </Link>
          ))}
        </Card>
      </div>
    </div>
  );
}
