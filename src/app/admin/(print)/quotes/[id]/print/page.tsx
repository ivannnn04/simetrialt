import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getContacts } from "@/lib/site-content";
import { formatPrice } from "@/lib/slug";
import { lineTotal, quoteNumber, quoteTotals, VAT_PCT } from "@/lib/quotes";
import { PrintButton } from "@/components/admin/PrintButton";

export const dynamic = "force-dynamic";

/** The offer as the customer receives it: print it or save it as PDF from the browser. */
export default async function QuotePrint({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const [q, contacts] = await Promise.all([db.quote.findUnique({ where: { id }, include: { items: { orderBy: { sort: "asc" } }, author: { select: { name: true, email: true } } } }), getContacts()]);
  if (!q) notFound();
  const t = quoteTotals(q.items, q.discountPct);
  const date = (d: Date) => d.toLocaleDateString("lt-LT");
  return (
    <main className="mx-auto max-w-[840px] bg-white p-10 text-[13px] leading-snug text-zinc-900 print:p-0">
      <div className="mb-6 flex items-start justify-between print:hidden">
        <p className="text-sm text-zinc-500">Peržiūra. Spausdinkite arba išsaugokite kaip PDF.</p>
        <PrintButton />
      </div>
      <header className="flex items-start justify-between border-b border-zinc-900 pb-6">
        <div>
          <p className="notranslate text-[28px] font-semibold tracking-tight" translate="no">simetria</p>
          <p className="mt-1 whitespace-pre-line text-zinc-600">{contacts.address}</p>
          <p className="text-zinc-600">{contacts.phone} · {contacts.email}</p>
        </div>
        <div className="text-right">
          <p className="text-[20px] font-semibold">Komercinis pasiūlymas {quoteNumber(q.number)}</p>
          <p className="text-zinc-600">Data: {date(q.updatedAt)}</p>
          {q.validUntil && <p className="text-zinc-600">Galioja iki: {date(q.validUntil)}</p>}
        </div>
      </header>

      <section className="grid grid-cols-2 gap-8 py-6">
        <div>
          <p className="mb-1 text-[11px] uppercase tracking-wide text-zinc-500">Klientas</p>
          <p className="font-medium">{q.customerName || "—"}</p>
          {q.company && <p>{q.company}</p>}
          {q.customerEmail && <p className="text-zinc-600">{q.customerEmail}</p>}
          {q.customerPhone && <p className="text-zinc-600">{q.customerPhone}</p>}
        </div>
        <div>
          <p className="mb-1 text-[11px] uppercase tracking-wide text-zinc-500">Parengė</p>
          <p className="font-medium">{q.author?.name ?? "Simetria"}</p>
          {q.author?.email && <p className="text-zinc-600">{q.author.email}</p>}
        </div>
      </section>

      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-zinc-900 text-left text-[11px] uppercase tracking-wide text-zinc-500">
            <th className="py-2 pr-3 font-medium">Produktas</th>
            <th className="py-2 pr-3 text-right font-medium">Kiekis</th>
            <th className="py-2 pr-3 text-right font-medium">Vnt. kaina</th>
            <th className="py-2 pr-3 text-right font-medium">Nuolaida</th>
            <th className="py-2 text-right font-medium">Suma</th>
          </tr>
        </thead>
        <tbody>
          {q.items.map((i) => (
            <tr key={i.id} className="border-b border-zinc-200 align-top">
              <td className="py-3 pr-3">
                <div className="flex items-start gap-3">
                  {i.image && <img src={i.image} alt="" className="h-14 w-14 rounded object-cover" />}
                  <div>
                    <p className="font-medium">{i.name}</p>
                    {i.sku && <p className="text-zinc-500">Kodas {i.sku}</p>}
                  </div>
                </div>
              </td>
              <td className="py-3 pr-3 text-right tabular-nums">{i.quantity}</td>
              <td className="py-3 pr-3 text-right tabular-nums">{formatPrice(i.unitCents)}</td>
              <td className="py-3 pr-3 text-right tabular-nums">{i.discountPct ? `${i.discountPct}%` : "—"}</td>
              <td className="py-3 text-right tabular-nums">{formatPrice(lineTotal(i))}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <section className="ml-auto mt-6 w-[320px] space-y-1">
        {(t.lineDiscount > 0 || t.cartDiscount > 0) && (
          <div className="flex justify-between text-zinc-600"><span>Kaina be nuolaidų</span><span className="tabular-nums">{formatPrice(t.list)}</span></div>
        )}
        {t.lineDiscount > 0 && <div className="flex justify-between text-zinc-600"><span>Nuolaidos pozicijoms</span><span className="tabular-nums">− {formatPrice(t.lineDiscount)}</span></div>}
        {t.cartDiscount > 0 && <div className="flex justify-between text-zinc-600"><span>Nuolaida pasiūlymui ({q.discountPct}%)</span><span className="tabular-nums">− {formatPrice(t.cartDiscount)}</span></div>}
        <div className="flex justify-between border-t border-zinc-900 pt-2 text-[16px] font-semibold"><span>Iš viso su PVM</span><span className="tabular-nums">{formatPrice(t.total)}</span></div>
        <div className="flex justify-between text-zinc-500"><span>iš jų PVM {VAT_PCT}%</span><span className="tabular-nums">{formatPrice(t.vat)}</span></div>
      </section>

      {q.note && (
        <section className="mt-8 border-t border-zinc-200 pt-4">
          <p className="mb-1 text-[11px] uppercase tracking-wide text-zinc-500">Pastabos</p>
          <p className="whitespace-pre-line">{q.note}</p>
        </section>
      )}
    </main>
  );
}
