import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { formatPrice } from "@/lib/slug";
import { quoteNumber, quoteTotals, QUOTE_STATUS } from "@/lib/quotes";
import { Badge, Card, PageTitle } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const c = await db.customer.findUnique({
    where: { id },
    include: { collections: { orderBy: { updatedAt: "desc" }, include: { items: { include: { product: { include: { images: { orderBy: { sort: "asc" }, take: 1 } } } } } } } },
  });
  if (!c) notFound();
  const quotes = await db.quote.findMany({ where: { customerEmail: c.email.toLowerCase() }, orderBy: { updatedAt: "desc" }, include: { items: true } });
  const unit = (p: { priceCents: number; salePriceCents: number | null }) => (p.salePriceCents != null && p.salePriceCents < p.priceCents ? p.salePriceCents : p.priceCents);
  const accepted = quotes.filter((q) => q.status === "ACCEPTED").map((q) => quoteTotals(q.items, q.discountPct).total);
  const spent = accepted.reduce((n, x) => n + x, 0);
  return (
    <div className="space-y-6">
      <PageTitle actions={<Link href="/admin/customers" className="text-sm text-zinc-600 underline">← Visi klientai</Link>}>{c.name}</PageTitle>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: "El. paštas", value: c.email },
          { label: "Įmonė", value: c.company || "—" },
          { label: "Išleista (priimti pasiūlymai)", value: formatPrice(spent) },
          { label: "Vidutinis pasiūlymas", value: accepted.length ? formatPrice(Math.round(spent / accepted.length)) : "—" },
        ].map((x) => (
          <div key={x.label} className="rounded-xl bg-white p-5 shadow-sm">
            <p className="text-sm text-zinc-500">{x.label}</p>
            <p className="truncate text-lg font-semibold">{x.value}</p>
          </div>
        ))}
      </div>

      <Card title={`Albumai (${c.collections.length})`} className="p-0">
        {c.collections.length === 0 && <p className="p-5 text-sm text-zinc-500">Albumų nėra.</p>}
        {c.collections.map((col) => {
          const value = col.items.reduce((n, i) => n + unit(i.product) * i.quantity, 0);
          return (
            <div key={col.id} className="border-t border-zinc-100 first:border-t-0">
              <div className="flex items-center justify-between px-5 py-3">
                <p className="font-medium">{col.name} <span className="text-zinc-400">· {col.items.length} prod.</span></p>
                <p className="tabular-nums text-sm">{formatPrice(value)}</p>
              </div>
              {col.items.length > 0 && (
                <table className="w-full text-sm">
                  <tbody>
                    {col.items.map((i) => (
                      <tr key={i.id} className="border-t border-zinc-50">
                        <td className="px-5 py-2">
                          <div className="flex items-center gap-3">
                            {i.product.images[0] ? <img src={i.product.images[0].url} alt="" className="h-10 w-10 rounded object-cover" /> : <span className="h-10 w-10 rounded bg-zinc-100" />}
                            <div>
                              <Link href={`/catalogue/${i.product.slug}`} target="_blank" className="underline">{i.product.name}</Link>
                              {i.note && <p className="text-xs text-zinc-500">{i.note}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-2 text-right tabular-nums text-zinc-500">{i.quantity} × {formatPrice(unit(i.product))}</td>
                        <td className="px-5 py-2 text-right tabular-nums">{formatPrice(unit(i.product) * i.quantity)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          );
        })}
      </Card>

      <Card title={`Pasiūlymai (${quotes.length})`} className="p-0">
        {quotes.length === 0 && <p className="p-5 text-sm text-zinc-500">Šiam el. paštui pasiūlymų dar nėra.</p>}
        {quotes.length > 0 && (
          <table className="w-full text-sm">
            <tbody>
              {quotes.map((q) => {
                const st = QUOTE_STATUS[q.status] ?? QUOTE_STATUS.DRAFT;
                return (
                  <tr key={q.id} className="border-t border-zinc-100 first:border-t-0">
                    <td className="px-5 py-3"><Link href={`/admin/quotes/${q.id}`} className="font-medium underline">{quoteNumber(q.number)}</Link></td>
                    <td className="px-5 py-3 text-zinc-500">{q.updatedAt.toLocaleDateString("lt-LT")}</td>
                    <td className="px-5 py-3"><Badge tone={st.tone}>{st.label}</Badge></td>
                    <td className="px-5 py-3 text-right tabular-nums">{formatPrice(quoteTotals(q.items, q.discountPct).total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
