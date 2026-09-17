import Link from "next/link";
import { db } from "@/lib/db";

export default async function AdminDashboard() {
  const [pages, products, leads, newLeads] = await Promise.all([
    db.page.count(),
    db.product.count(),
    db.lead.count(),
    db.lead.count({ where: { status: "NEW" } }),
  ]);
  const recent = await db.lead.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  const cards = [
    { label: "Puslapiai", value: pages, href: "/admin/pages" },
    { label: "Produktai", value: products, href: "/admin/products" },
    { label: "Užklausos", value: leads, href: "/admin/leads" },
    { label: "Naujos užklausos", value: newLeads, href: "/admin/leads?status=NEW" },
  ];
  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Apžvalga</h1>
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className="rounded-xl bg-white p-5 shadow-sm hover:shadow"
          >
            <p className="text-sm text-zinc-500">{c.label}</p>
            <p className="text-3xl font-semibold">{c.value}</p>
          </Link>
        ))}
      </div>
      <h2 className="mb-3 text-lg font-medium">Naujausios užklausos</h2>
      <div className="overflow-hidden rounded-xl bg-white shadow-sm">
        {recent.length === 0 && (
          <p className="p-5 text-sm text-zinc-500">Užklausų dar nėra.</p>
        )}
        {recent.map((lead) => (
          <Link
            key={lead.id}
            href={`/admin/leads/${lead.id}`}
            className="flex items-center justify-between border-b border-zinc-100 p-4 text-sm last:border-0 hover:bg-zinc-50"
          >
            <span className="font-medium">{lead.name}</span>
            <span className="text-zinc-500">
              {lead.createdAt.toLocaleDateString("lt-LT")}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
