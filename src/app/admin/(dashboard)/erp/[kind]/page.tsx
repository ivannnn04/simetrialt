import Link from "next/link";
import { notFound } from "next/navigation";
import { DOC, PATH_TYPES, type DocType } from "@/lib/erp/config";
import { listDocuments, userNames, type ListFilters } from "@/lib/erp/queries";
import { eur, fmtDate, pct } from "@/lib/erp/money";
import { Money, StatusBadge, Td, Th } from "@/components/erp/ErpUi";
import { cn } from "@/lib/cn";

export const dynamic = "force-dynamic";

export default async function ErpList({ params, searchParams }: { params: Promise<{ kind: string }>; searchParams: Promise<ListFilters> }) {
  const [{ kind }, f] = await Promise.all([params, searchParams]);
  const types = PATH_TYPES[kind] as DocType[] | undefined;
  if (!types) notFound();
  const main = types[0];
  const meta = DOC[main];
  const [{ docs, statusCounts, statuses }, users] = await Promise.all([listDocuments(kind, f), userNames()]);
  const selected = new Set(Array.isArray(f.status) ? f.status : f.status ? [f.status] : []);
  const isOffer = main === "OFFER";
  const isInvoice = ["INVOICE", "PURCHASE_INVOICE"].includes(main);
  const showMargin = meta.withCost;
  const sum = (k: "net" | "total" | "margin") => docs.reduce((n, d) => n + d.t[k], 0);
  const weighted = docs.reduce((n, d) => n + Math.round((d.t.net * (d.probability ?? 0)) / 100), 0);
  const open = docs.reduce((n, d) => n + d.open, 0);
  const qs = (patch: Record<string, string | string[] | undefined>) => {
    const p = new URLSearchParams();
    const merged = { ...f, ...patch } as Record<string, string | string[] | undefined>;
    for (const [k, v] of Object.entries(merged)) for (const x of Array.isArray(v) ? v : v ? [v] : []) p.append(k, x);
    const s = p.toString();
    return s ? `?${s}` : "";
  };
  const toggle = (s: string) => {
    const next = new Set(selected);
    if (next.has(s)) next.delete(s);
    else next.add(s);
    return qs({ status: [...next] });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{kind === "invoices" ? "Pardavimo sąskaitos" : meta.plural}</h1>
        <div className="flex gap-2">
          <a href={`/api/erp/export?kind=${kind}${qs({}).replace("?", "&")}`} className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm hover:bg-zinc-50">Eksportuoti CSV</a>
          {types.map((t) => (
            <Link key={t} href={`/admin/erp/${kind}/new?type=${t}`} className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700">
              + {DOC[t].label}
            </Link>
          ))}
        </div>
      </div>

      <form className="flex flex-wrap items-end gap-2 rounded-xl bg-white p-3 shadow-sm">
        <label className="text-xs text-zinc-500">
          Paieška
          <input name="q" defaultValue={f.q} placeholder="Nr., klientas, produktas…" className="mt-1 block w-64 rounded-md border border-zinc-300 px-2 py-1.5 text-sm" />
        </label>
        {kind === "invoices" && (
          <label className="text-xs text-zinc-500">
            Tipas
            <select name="type" defaultValue={f.type ?? ""} className="mt-1 block rounded-md border border-zinc-300 px-2 py-1.5 text-sm">
              <option value="">Visos</option>
              {types.map((t) => <option key={t} value={t}>{DOC[t].label}</option>)}
            </select>
          </label>
        )}
        <label className="text-xs text-zinc-500">
          Vadybininkas
          <select name="manager" defaultValue={f.manager ?? ""} className="mt-1 block rounded-md border border-zinc-300 px-2 py-1.5 text-sm">
            <option value="">Visi</option>
            {Object.entries(users).map(([id, n]) => <option key={id} value={id}>{n}</option>)}
          </select>
        </label>
        <label className="text-xs text-zinc-500">
          Nuo
          <input type="date" name="from" defaultValue={f.from} className="mt-1 block rounded-md border border-zinc-300 px-2 py-1.5 text-sm" />
        </label>
        <label className="text-xs text-zinc-500">
          Iki
          <input type="date" name="to" defaultValue={f.to} className="mt-1 block rounded-md border border-zinc-300 px-2 py-1.5 text-sm" />
        </label>
        {[...selected].map((s) => <input key={s} type="hidden" name="status" value={s} />)}
        <button className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm text-white">Filtruoti</button>
        <Link href={`/admin/erp/${kind}`} className="px-2 py-1.5 text-sm text-zinc-500 underline">Išvalyti</Link>
      </form>

      <div className="flex flex-wrap gap-1.5">
        {statuses.map((s) => (
          <Link key={s.key} href={toggle(s.key)} className={cn("rounded-full border px-2.5 py-1 text-xs", selected.has(s.key) ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50")}>
            {s.key} <span className="opacity-60">{statusCounts[s.key] ?? 0}</span>
          </Link>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b border-zinc-100 bg-zinc-50">
            <tr>
              <Th>Nr.</Th>
              <Th>Data</Th>
              <Th>{meta.counterparty === "supplier" ? "Tiekėjas" : "Klientas"}</Th>
              {meta.counterparty === "client" && <Th>Architektas / partneris</Th>}
              <Th>Būsena</Th>
              <Th>Vadybininkas</Th>
              <Th right>Suma be PVM</Th>
              {showMargin && <Th right>Marža</Th>}
              {isOffer && <Th right>Tikimybė</Th>}
              {isInvoice && <Th right>Liko mokėti</Th>}
              {isInvoice && <Th>Terminas</Th>}
            </tr>
          </thead>
          <tbody>
            {docs.map((d) => (
              <tr key={d.id} className="border-b border-zinc-50 hover:bg-zinc-50">
                <Td>
                  <Link href={`/admin/erp/${kind}/${d.id}`} className="font-medium underline">{d.number}</Link>
                  {kind === "invoices" && d.type !== "INVOICE" && <span className="ml-1 text-[11px] text-zinc-500">{DOC[d.type as DocType].label}</span>}
                </Td>
                <Td className="whitespace-nowrap text-zinc-500">{fmtDate(d.date)}</Td>
                <Td>{(meta.counterparty === "supplier" ? d.supplier?.name : d.client?.name) ?? <span className="text-zinc-400">—</span>}</Td>
                {meta.counterparty === "client" && <Td className="text-zinc-600">{d.party?.name ?? <span className="text-zinc-400">{d.channel}</span>}</Td>}
                <Td><StatusBadge type={d.type} status={d.status} /></Td>
                <Td className="text-zinc-500">{d.managerId ? users[d.managerId] : "—"}</Td>
                <Td right><Money cents={d.t.net} /></Td>
                {showMargin && <Td right className={d.t.marginPct < 20 ? "text-amber-700" : ""}>{eur(d.t.margin)} <span className="text-xs text-zinc-400">{pct(d.t.marginPct)}</span></Td>}
                {isOffer && <Td right>{d.probability ?? 0}%</Td>}
                {isInvoice && <Td right><Money cents={d.open} className={d.open ? "font-medium" : "text-zinc-400"} /></Td>}
                {isInvoice && <Td className={cn("whitespace-nowrap", d.status === "Vėluoja" ? "text-red-600" : "text-zinc-500")}>{fmtDate(d.dueDate)}</Td>}
              </tr>
            ))}
            {docs.length === 0 && (
              <tr><td colSpan={11} className="p-8 text-center text-zinc-500">Dokumentų nėra. Sukurkite naują arba įjunkite demonstracinius duomenis skiltyje „Nustatymai“.</td></tr>
            )}
          </tbody>
          {docs.length > 0 && (
            <tfoot className="border-t-2 border-zinc-200 bg-zinc-50 font-medium">
              <tr>
                <Td>Iš viso: {docs.length}</Td>
                <Td />
                <Td />
                {meta.counterparty === "client" && <Td />}
                <Td />
                <Td className="text-xs text-zinc-500">vid. {eur(Math.round(sum("net") / docs.length))}</Td>
                <Td right>{eur(sum("net"))}</Td>
                {showMargin && <Td right>{eur(sum("margin"))} <span className="text-xs text-zinc-500">{pct(sum("net") ? (sum("margin") / docs.reduce((n, d) => n + d.t.goods, 0)) * 100 : 0)}</span></Td>}
                {isOffer && <Td right className="text-xs">svert. {eur(weighted)}</Td>}
                {isInvoice && <Td right>{eur(open)}</Td>}
                {isInvoice && <Td />}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
