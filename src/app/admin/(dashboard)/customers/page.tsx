import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { formatPrice } from "@/lib/slug";
import { quoteTotals } from "@/lib/quotes";
import { Card, PageTitle } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

/**
 * Registered website customers with their albums (saved products) and the money side: quotes that
 * were accepted count as spent, so "total spent" is the sum of accepted quotes sent to the customer's
 * e-mail and "average" is per accepted quote.
 */
export default async function CustomersAdmin() {
  await requireAdmin();
  const [customers, quotes] = await Promise.all([
    db.customer.findMany({
      orderBy: { createdAt: "desc" },
      include: { collections: { include: { items: { include: { product: { select: { priceCents: true, salePriceCents: true } } } } } } },
    }),
    db.quote.findMany({ where: { customerEmail: { not: "" } }, include: { items: true } }),
  ]);
  const byEmail = new Map<string, { accepted: number[]; open: number }>();
  for (const q of quotes) {
    const e = byEmail.get(q.customerEmail) ?? { accepted: [], open: 0 };
    if (q.status === "ACCEPTED") e.accepted.push(quoteTotals(q.items, q.discountPct).total);
    else if (q.status !== "DECLINED") e.open++;
    byEmail.set(q.customerEmail, e);
  }
  const rows = customers.map((c) => {
    const items = c.collections.flatMap((col) => col.items);
    const albumValue = items.reduce((n, i) => n + (i.product.salePriceCents != null && i.product.salePriceCents < i.product.priceCents ? i.product.salePriceCents : i.product.priceCents) * i.quantity, 0);
    const q = byEmail.get(c.email.toLowerCase()) ?? { accepted: [], open: 0 };
    const spent = q.accepted.reduce((n, x) => n + x, 0);
    return { c, albums: c.collections.length, items: items.reduce((n, i) => n + i.quantity, 0), albumValue, spent, orders: q.accepted.length, open: q.open, avg: q.accepted.length ? Math.round(spent / q.accepted.length) : 0 };
  });
  const totalSpent = rows.reduce((n, r) => n + r.spent, 0);
  return (
    <div className="space-y-6">
      <PageTitle>Klientai</PageTitle>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: "Registruoti klientai", value: String(customers.length) },
          { label: "Albumai (krepšeliai)", value: String(rows.reduce((n, r) => n + r.albums, 0)) },
          { label: "Priimti pasiūlymai", value: String(rows.reduce((n, r) => n + r.orders, 0)) },
          { label: "Išleista iš viso", value: formatPrice(totalSpent) },
        ].map((c) => (
          <div key={c.label} className="rounded-xl bg-white p-5 shadow-sm">
            <p className="text-sm text-zinc-500">{c.label}</p>
            <p className="text-2xl font-semibold">{c.value}</p>
          </div>
        ))}
      </div>
      <p className="text-sm text-zinc-600">
        Albumai – svetainėje išsaugoti produktai (klientų krepšeliai). „Išleista“ – priimtų pasiūlymų, parengtų šiam el. paštui, suma; vidurkis – vienam priimtam pasiūlymui.
      </p>
      <Card className="p-0">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-zinc-500">
            <tr>
              <th className="p-4 font-medium">Klientas</th>
              <th className="p-4 font-medium">Registracija</th>
              <th className="p-4 text-right font-medium">Albumai</th>
              <th className="p-4 text-right font-medium">Produktai albumuose</th>
              <th className="p-4 text-right font-medium">Albumų vertė</th>
              <th className="p-4 text-right font-medium">Pasiūlymai</th>
              <th className="p-4 text-right font-medium">Išleista</th>
              <th className="p-4 text-right font-medium">Vidurkis</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ c, ...r }) => (
              <tr key={c.id} className="border-t border-zinc-100 hover:bg-zinc-50">
                <td className="p-4">
                  <Link href={`/admin/customers/${c.id}`} className="font-medium underline">{c.name}</Link>
                  <p className="text-xs text-zinc-500">
                    {c.email}{c.company ? ` · ${c.company}` : ""}
                    {!c.emailVerifiedAt && <span className="text-amber-600"> · el. paštas nepatvirtintas</span>}
                  </p>
                </td>
                <td className="p-4 text-zinc-500">{c.createdAt.toLocaleDateString("lt-LT")}</td>
                <td className="p-4 text-right tabular-nums">{r.albums}</td>
                <td className="p-4 text-right tabular-nums">{r.items}</td>
                <td className="p-4 text-right tabular-nums">{formatPrice(r.albumValue)}</td>
                <td className="p-4 text-right tabular-nums">{r.orders} priimti{r.open ? ` · ${r.open} atviri` : ""}</td>
                <td className="p-4 text-right tabular-nums">{formatPrice(r.spent)}</td>
                <td className="p-4 text-right tabular-nums">{r.orders ? formatPrice(r.avg) : "—"}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={8} className="p-8 text-center text-zinc-500">Registruotų klientų dar nėra.</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
