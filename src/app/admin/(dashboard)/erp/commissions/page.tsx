import Link from "next/link";
import { db } from "@/lib/db";
import { eur, fmtDate } from "@/lib/erp/money";
import { setCommissionStatus } from "@/actions/erp";
import { Kpi, Td, Th } from "@/components/erp/ErpUi";
import { cn } from "@/lib/cn";

export const dynamic = "force-dynamic";

const LABEL = { ACCRUED: "Priskaičiuota", APPROVED: "Patvirtinta", PAID: "Išmokėta" } as const;
const COLOR = { ACCRUED: "bg-amber-100 text-amber-800", APPROVED: "bg-blue-100 text-blue-800", PAID: "bg-green-100 text-green-800" } as const;

export default async function ErpCommissions({ searchParams }: { searchParams: Promise<{ status?: string; year?: string }> }) {
  const f = await searchParams;
  const year = Number(f.year) || new Date().getFullYear();
  const all = await db.erpCommission.findMany({ include: { architect: true, document: { include: { client: true } } }, orderBy: { createdAt: "desc" } });
  const rows = all.filter((c) => (!f.status || c.status === f.status));
  const inYear = (c: (typeof all)[number]) => c.document.date.getFullYear() === year;
  const unpaid = all.filter((c) => c.status !== "PAID").reduce((n, c) => n + c.amountCents, 0);
  const paidYear = all.filter((c) => c.status === "PAID" && c.paidAt && c.paidAt.getFullYear() === year).reduce((n, c) => n + c.amountCents, 0);
  const byArch = new Map<string, { id: string; name: string; tags: string[]; sales: number; accrued: number; paid: number; prev: number }>();
  for (const c of all) {
    const e = byArch.get(c.architectId) ?? { id: c.architectId, name: c.architect.name, tags: c.architect.tags, sales: 0, accrued: 0, paid: 0, prev: 0 };
    if (inYear(c)) {
      e.sales += c.baseCents;
      if (c.status === "PAID") e.paid += c.amountCents;
      else e.accrued += c.amountCents;
    } else if (c.document.date.getFullYear() === year - 1) e.prev += c.baseCents;
    byArch.set(c.architectId, e);
  }
  const arch = [...byArch.values()].sort((a, b) => b.sales - a.sales);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Architektų komisiniai (padėkos mokestis)</h1>
        <div className="flex gap-1 text-sm">
          {[year - 1, year].map((y) => <Link key={y} href={`?year=${y}`} className={cn("rounded-md px-3 py-1.5", y === year ? "bg-zinc-900 text-white" : "bg-white shadow-sm")}>{y}</Link>)}
        </div>
      </div>
      <p className="max-w-3xl text-sm text-zinc-600">Komisinis priskaičiuojamas automatiškai, kai apmokama sąskaita su architektu ar partneriu (procentas nuo grynojo pardavimo, nustatomas kontakto kortelėje). Skaičiavimo taisyklę patvirtinsime su klientu (spec. §13).</p>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Neišmokėta" value={eur(unpaid)} href="?status=ACCRUED" />
        <Kpi label={`Išmokėta ${year}`} value={eur(paidYear)} />
        <Kpi label="Architektai su pardavimais" value={String(arch.filter((a) => a.sales).length)} />
        <Kpi label={`Pardavimai per architektus ${year}`} value={eur(arch.reduce((n, a) => n + a.sales, 0))} />
      </div>
      <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b border-zinc-100 bg-zinc-50"><tr><Th>Architektas</Th><Th>Grupė</Th><Th right>Pardavimai {year}</Th><Th right>{year - 1}</Th><Th right>Neišmokėta</Th><Th right>Išmokėta</Th></tr></thead>
          <tbody>
            {arch.map((a) => (
              <tr key={a.id} className="border-b border-zinc-50">
                <Td><Link href={`/admin/erp/contacts/${a.id}`} className="underline">{a.name}</Link></Td>
                <Td className="text-xs text-zinc-500">{a.tags.join(", ")}</Td>
                <Td right>{eur(a.sales)}</Td>
                <Td right className="text-zinc-500">{eur(a.prev)}</Td>
                <Td right className={a.accrued ? "font-medium text-amber-700" : ""}>{eur(a.accrued)}</Td>
                <Td right>{eur(a.paid)}</Td>
              </tr>
            ))}
            {arch.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-zinc-500">Komisinių dar nėra.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="flex gap-1.5 text-xs">
        {[undefined, "ACCRUED", "APPROVED", "PAID"].map((s) => (
          <Link key={s ?? "all"} href={`?year=${year}${s ? `&status=${s}` : ""}`} className={cn("rounded-full border px-2.5 py-1", f.status === s ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 bg-white")}>{s ? LABEL[s as keyof typeof LABEL] : "Visi"}</Link>
        ))}
      </div>
      <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b border-zinc-100 bg-zinc-50"><tr><Th>Sąskaita</Th><Th>Data</Th><Th>Klientas</Th><Th>Architektas</Th><Th right>Bazė</Th><Th right>%</Th><Th right>Komisinis</Th><Th>Būsena</Th><Th /></tr></thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className="border-b border-zinc-50">
                <Td><Link className="underline" href={`/admin/erp/invoices/${c.documentId}`}>{c.document.number}</Link></Td>
                <Td className="text-zinc-500">{fmtDate(c.document.date)}</Td>
                <Td>{c.document.client?.name}</Td>
                <Td>{c.architect.name}</Td>
                <Td right>{eur(c.baseCents)}</Td>
                <Td right>{c.pct}</Td>
                <Td right className="font-medium">{eur(c.amountCents)}</Td>
                <Td><span className={cn("rounded-full px-2 py-0.5 text-xs", COLOR[c.status as keyof typeof COLOR])}>{LABEL[c.status as keyof typeof LABEL]}{c.paidAt ? ` ${fmtDate(c.paidAt)}` : ""}</span></Td>
                <Td>
                  {c.status !== "PAID" && (
                    <div className="flex gap-1">
                      {c.status === "ACCRUED" && <form action={setCommissionStatus.bind(null, c.id, "APPROVED")}><button className="rounded border border-zinc-300 px-2 py-0.5 text-xs">Patvirtinti</button></form>}
                      <form action={setCommissionStatus.bind(null, c.id, "PAID")}><button className="rounded bg-zinc-900 px-2 py-0.5 text-xs text-white">Išmokėta</button></form>
                    </div>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
