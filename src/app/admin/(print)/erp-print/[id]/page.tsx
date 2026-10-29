import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireEditor } from "@/lib/auth";
import { COMPANY, DOC, type DocType } from "@/lib/erp/config";
import { amountInWords, docTotals, eur, fmtDate, lineNet } from "@/lib/erp/money";
import { getContacts } from "@/lib/site-content";
import { PrintButton } from "@/components/admin/PrintButton";

export const dynamic = "force-dynamic";

const TITLES: Record<string, Partial<Record<DocType, string>>> = {
  standard: { OFFER: "KOMERCINIS PASIŪLYMAS", ORDER: "UŽSAKYMAS", PURCHASE_ORDER: "PIRKIMO UŽSAKYMAS", INVOICE: "PVM SĄSKAITA FAKTŪRA", PREPAYMENT: "IŠANKSTINĖ SĄSKAITA", CREDIT: "KREDITINĖ PVM SĄSKAITA FAKTŪRA", PURCHASE_INVOICE: "PIRKIMO SĄSKAITA" },
};
const VARIANT_TITLE: Record<string, string> = {
  contract: "UŽSAKYMO SUTARTIS",
  act: "PREKIŲ PRIĖMIMO–PERDAVIMO AKTAS",
  waybill: "VAŽTARAŠTIS",
  kpo: "KASOS PAJAMŲ ORDERIS (KPO)",
  partners: "PASIŪLYMAS PARTNERIAMS",
  en: "VAT INVOICE",
  "no-prices": "PIRKIMO UŽSAKYMAS",
};

export default async function ErpPrint({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ v?: string }> }) {
  await requireEditor();
  const [{ id }, { v = "standard" }] = await Promise.all([params, searchParams]);
  const doc = await db.erpDocument.findUnique({ where: { id }, include: { lines: { orderBy: { sort: "asc" } }, client: true, supplier: true, party: true, payments: true, parent: true } });
  if (!doc) notFound();
  const site = await getContacts();
  const type = doc.type as DocType;
  const en = v === "en";
  const prices = !["no-prices", "waybill", "act"].includes(v);
  const showDiscount = !["no-discount", "partners"].includes(v) && doc.lines.some((l) => l.discountPct > 0);
  const t = docTotals(doc.lines, doc.discountPct);
  const counterparty = doc.client ?? doc.supplier;
  const title = VARIANT_TITLE[v] ?? TITLES.standard[type] ?? DOC[type].label;
  const L = en
    ? { seller: "Seller", buyer: "Buyer", no: "No.", date: "Date", due: "Due date", item: "Item", qty: "Qty", price: "Unit price", disc: "Disc.", sum: "Amount", net: "Total excl. VAT", vat: "VAT 21%", total: "Total", words: "Amount in words", signS: "Issued by", signB: "Received by" }
    : { seller: "Pardavėjas", buyer: type === "PURCHASE_ORDER" ? "Tiekėjas" : "Pirkėjas", no: "Nr.", date: "Data", due: type === "OFFER" ? "Galioja iki" : "Apmokėti iki", item: "Prekė / paslauga", qty: "Kiekis", price: "Kaina be PVM", disc: "Nuol.", sum: "Suma", net: "Suma be PVM", vat: "PVM 21%", total: "Iš viso su PVM", words: "Suma žodžiais", signS: "Išrašė", signB: "Priėmė" };

  return (
    <div className="mx-auto max-w-[800px] bg-white p-10 text-[13px] leading-snug text-black print:p-0">
      <div className="mb-6 flex justify-end print:hidden"><PrintButton /></div>
      <header className="mb-8 flex items-start justify-between gap-8">
        <div>
          <p className="text-2xl font-semibold tracking-tight">simetria</p>
          <p className="mt-2">{COMPANY.name}</p>
          <p>Įm. k. {COMPANY.regCode} · PVM k. {COMPANY.vatCode}</p>
          <p>{site.address ?? COMPANY.address}</p>
          <p>{site.phone} · {site.email}</p>
          <p>{COMPANY.bank}</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold">{title}</p>
          <p>{L.no} <b>{doc.number}</b></p>
          <p>{L.date}: {fmtDate(doc.date)}</p>
          {(doc.dueDate || doc.validUntil) && <p>{L.due}: {fmtDate(doc.dueDate ?? doc.validUntil)}</p>}
          {doc.parent && <p className="text-xs text-zinc-600">{en ? "Order" : "Pagal"} {doc.parent.number}</p>}
        </div>
      </header>

      <section className="mb-6 grid grid-cols-2 gap-8">
        <div>
          <p className="text-xs uppercase text-zinc-500">{L.buyer}</p>
          <p className="font-medium">{counterparty?.name ?? "—"}</p>
          {counterparty?.regCode && <p>Įm. k. {counterparty.regCode}</p>}
          {counterparty?.vatCode && <p>PVM k. {counterparty.vatCode}</p>}
          {counterparty?.address && <p>{counterparty.address}</p>}
          {counterparty?.email && <p>{counterparty.email}</p>}
        </div>
        {v === "contract" && (
          <div className="text-xs">
            <p><b>Avansas:</b> {doc.advancePct}% ({eur(Math.round((t.total * doc.advancePct) / 100))})</p>
            <p><b>Prekių pristatymo terminas:</b> {doc.deliveryTerm || "—"}</p>
          </div>
        )}
      </section>

      {v === "kpo" ? (
        <section className="space-y-3 border border-black p-4">
          <p>Gauta iš: <b>{counterparty?.name}</b></p>
          <p>Pagrindas: {DOC[type].label} {doc.number}</p>
          <p>Suma: <b>{eur(doc.payments.filter((p) => p.method.startsWith("Grynieji")).reduce((n, p) => n + p.amountCents, 0) || t.total)}</b></p>
          <p>{L.words}: {amountInWords(doc.payments.filter((p) => p.method.startsWith("Grynieji")).reduce((n, p) => n + p.amountCents, 0) || t.total)}</p>
        </section>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-y border-black text-left text-[11px] uppercase">
              <th className="py-1.5 pr-2">#</th>
              {v === "partners" || v === "standard" || v === "contract" ? <th className="py-1.5 pr-2" /> : null}
              <th className="py-1.5 pr-2">{L.item}</th>
              <th className="py-1.5 pr-2 text-right">{L.qty}</th>
              {prices && <th className="py-1.5 pr-2 text-right">{L.price}</th>}
              {prices && showDiscount && <th className="py-1.5 pr-2 text-right">{L.disc}</th>}
              {prices && <th className="py-1.5 text-right">{L.sum}</th>}
            </tr>
          </thead>
          <tbody>
            {doc.lines.map((l, i) => (
              <tr key={l.id} className="border-b border-zinc-200 align-top">
                <td className="py-2 pr-2">{i + 1}</td>
                {v === "partners" || v === "standard" || v === "contract" ? (
                  <td className="w-16 py-2 pr-2">{/* eslint-disable-next-line @next/next/no-img-element */}{l.image ? <img src={l.image} alt="" className="h-14 w-14 object-contain" /> : null}</td>
                ) : null}
                <td className="py-2 pr-2">
                  <p className="font-medium">{l.name}</p>
                  {(l.code || l.description) && <p className="text-[11px] text-zinc-600">{[l.code, l.description].filter(Boolean).join(" · ")}</p>}
                </td>
                <td className="py-2 pr-2 text-right">{l.qty} {l.unit}</td>
                {prices && <td className="py-2 pr-2 text-right tabular-nums">{eur(showDiscount ? l.priceCents : Math.round(l.priceCents * (1 - l.discountPct / 100)))}</td>}
                {prices && showDiscount && <td className="py-2 pr-2 text-right">{l.discountPct ? `${l.discountPct}%` : ""}</td>}
                {prices && <td className="py-2 text-right tabular-nums">{eur(lineNet(l))}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {prices && v !== "kpo" && (
        <section className="mt-4 ml-auto w-72 space-y-1">
          {doc.discountPct > 0 && <p className="flex justify-between"><span>{en ? "Discount" : "Nuolaida"} {doc.discountPct}%</span></p>}
          <p className="flex justify-between"><span>{L.net}</span><span className="tabular-nums">{eur(t.net)}</span></p>
          <p className="flex justify-between"><span>{L.vat}</span><span className="tabular-nums">{eur(t.vat)}</span></p>
          <p className="flex justify-between border-t border-black pt-1 text-base font-semibold"><span>{L.total}</span><span className="tabular-nums">{eur(t.total)}</span></p>
        </section>
      )}
      {prices && v !== "kpo" && <p className="mt-3 text-xs">{L.words}: {amountInWords(t.total)}</p>}
      {v === "contract" && doc.contractText && <section className="mt-6 whitespace-pre-line text-xs">{doc.contractText}</section>}
      {doc.note && <p className="mt-4 text-xs text-zinc-700">{doc.note}</p>}

      <footer className="mt-16 grid grid-cols-2 gap-16 text-xs">
        <div><div className="mb-1 h-10 border-b border-black" />{L.signS}</div>
        <div><div className="mb-1 h-10 border-b border-black" />{L.signB}</div>
      </footer>
    </div>
  );
}
