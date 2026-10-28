import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { createQuote } from "@/actions/quotes";
import { formatPrice } from "@/lib/slug";
import { quoteNumber, quoteTotals, QUOTE_STATUS } from "@/lib/quotes";
import { Badge, Card, PageTitle, PrimaryButton } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export default async function QuotesList({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const me = await requireUser();
  const { status } = await searchParams;
  const quotes = await db.quote.findMany({
    where: status ? { status } : undefined,
    orderBy: { updatedAt: "desc" },
    include: { items: true, author: { select: { name: true } } },
    take: 300,
  });
  return (
    <div className="space-y-6">
      <PageTitle
        actions={
          <form action={createQuote}>
            <PrimaryButton type="submit">+ Naujas pasiūlymas</PrimaryButton>
          </form>
        }
      >
        Pasiūlymai
      </PageTitle>
      <p className="text-sm text-zinc-600">
        Pasiūlymą sudarykite iš katalogo produktų: ieškokite jų čia arba svetainėje atidarę produktą spauskite „Į pasiūlymą“. Nuolaidą galima
        pritaikyti kiekvienai pozicijai atskirai ir visam pasiūlymui.
      </p>
      <div className="flex flex-wrap gap-2 text-sm">
        <Link href="/admin/quotes" className={`rounded-full px-3 py-1 ${!status ? "bg-zinc-900 text-white" : "bg-white shadow-sm hover:bg-zinc-50"}`}>Visi</Link>
        {Object.entries(QUOTE_STATUS).map(([k, v]) => (
          <Link key={k} href={`/admin/quotes?status=${k}`} className={`rounded-full px-3 py-1 ${status === k ? "bg-zinc-900 text-white" : "bg-white shadow-sm hover:bg-zinc-50"}`}>
            {v.label}
          </Link>
        ))}
      </div>
      <Card className="p-0">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-zinc-500">
            <tr>
              <th className="p-4 font-medium">Nr.</th>
              <th className="p-4 font-medium">Klientas</th>
              <th className="p-4 font-medium">Pozicijos</th>
              <th className="p-4 text-right font-medium">Suma</th>
              <th className="p-4 font-medium">Būsena</th>
              <th className="p-4 font-medium">Parengė</th>
              <th className="p-4 font-medium">Atnaujinta</th>
            </tr>
          </thead>
          <tbody>
            {quotes.map((q) => {
              const t = quoteTotals(q.items, q.discountPct);
              const st = QUOTE_STATUS[q.status] ?? QUOTE_STATUS.DRAFT;
              return (
                <tr key={q.id} className="border-t border-zinc-100 hover:bg-zinc-50">
                  <td className="p-4 font-medium"><Link href={`/admin/quotes/${q.id}`} className="underline">{quoteNumber(q.number)}</Link></td>
                  <td className="p-4">
                    {q.customerName || q.company || <span className="text-zinc-400">—</span>}
                    {q.customerEmail && <p className="text-xs text-zinc-500">{q.customerEmail}</p>}
                  </td>
                  <td className="p-4 text-zinc-500">{q.items.reduce((n, i) => n + i.quantity, 0)}</td>
                  <td className="p-4 text-right tabular-nums">{formatPrice(t.total)}</td>
                  <td className="p-4"><Badge tone={st.tone}>{st.label}</Badge></td>
                  <td className="p-4 text-zinc-500">{q.author?.name ?? "—"}{q.authorId === me.id ? " (jūs)" : ""}</td>
                  <td className="p-4 text-zinc-500">{q.updatedAt.toLocaleDateString("lt-LT")}</td>
                </tr>
              );
            })}
            {quotes.length === 0 && (
              <tr><td colSpan={7} className="p-8 text-center text-zinc-500">Pasiūlymų dar nėra.</td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
