import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { deleteQuote } from "@/actions/quotes";
import { quoteNumber } from "@/lib/quotes";
import { PageTitle } from "@/components/admin/ui";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { QuoteEditor } from "@/components/admin/QuoteEditor";

export const dynamic = "force-dynamic";

export default async function QuotePage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const q = await db.quote.findUnique({ where: { id }, include: { items: { orderBy: { sort: "asc" } } } });
  if (!q) notFound();
  return (
    <div className="space-y-6">
      <PageTitle
        actions={
          <div className="flex items-center gap-3">
            <Link href="/admin/quotes" className="text-sm text-zinc-600 underline">← Visi pasiūlymai</Link>
            <form action={deleteQuote.bind(null, q.id)}>
              <ConfirmButton type="submit" message={`Ištrinti pasiūlymą ${quoteNumber(q.number)}?`} className="px-3 py-1 text-xs">Ištrinti</ConfirmButton>
            </form>
          </div>
        }
      >
        Pasiūlymas {quoteNumber(q.number)}
      </PageTitle>
      <QuoteEditor
        quote={{
          id: q.id,
          number: q.number,
          customerName: q.customerName,
          customerEmail: q.customerEmail,
          customerPhone: q.customerPhone,
          company: q.company,
          note: q.note,
          discountPct: q.discountPct,
          status: q.status,
          validUntil: q.validUntil ? q.validUntil.toISOString().slice(0, 10) : "",
          items: q.items.map((i) => ({ id: i.id, productId: i.productId, name: i.name, sku: i.sku, image: i.image, unitCents: i.unitCents, quantity: i.quantity, discountPct: i.discountPct })),
        }}
      />
    </div>
  );
}
