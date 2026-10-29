import Link from "next/link";
import { db } from "@/lib/db";
import { STATUSES } from "@/lib/erp/config";
import { docTotals, eur, lineCost, lineNet, pct } from "@/lib/erp/money";
import { revenueDocs, sumNet, userNames } from "@/lib/erp/queries";
import { Bar, Td, Th } from "@/components/erp/ErpUi";
import { cn } from "@/lib/cn";

export const dynamic = "force-dynamic";

const REPORTS = [
  ["managers", "Vadybininkų mėnesio pardavimai"],
  ["suppliers", "Pelningumas pagal tiekėją"],
  ["clients", "TOP klientai"],
  ["success", "Pasiūlymų sėkmė"],
  ["brands", "Pardavimai pagal gamintoją"],
  ["yoy", "Mėnesių palyginimas su praėjusiais metais"],
  ["activities", "Veiklos pagal tipą (šis mėn.)"],
] as const;
const MONTHS = ["Sau", "Vas", "Kov", "Bal", "Geg", "Bir", "Lie", "Rgp", "Rgs", "Spa", "Lap", "Grd"];

export default async function ErpReports({ searchParams }: { searchParams: Promise<{ r?: string; year?: string }> }) {
  const f = await searchParams;
  const r = REPORTS.some(([k]) => k === f.r) ? f.r! : "managers";
  const year = Number(f.year) || new Date().getFullYear();
  const from = new Date(year, 0, 1);
  const to = new Date(year + 1, 0, 1);
  const users = await userNames();
  let body: React.ReactNode = null;

  if (r === "managers") {
    const docs = await revenueDocs(from, to);
    const rows = new Map<string, number[]>();
    for (const d of docs) {
      const k = d.managerId ?? "—";
      const arr = rows.get(k) ?? Array(12).fill(0);
      arr[d.date.getMonth()] += d.t.net;
      rows.set(k, arr);
    }
    body = (
      <table className="w-full text-sm">
        <thead className="bg-zinc-50"><tr><Th>Vadybininkas</Th>{MONTHS.map((m) => <Th key={m} right>{m}</Th>)}<Th right>Iš viso</Th></tr></thead>
        <tbody>
          {[...rows.entries()].map(([k, arr]) => (
            <tr key={k} className="border-t border-zinc-50"><Td>{users[k] ?? "Nepriskirta"}</Td>{arr.map((v, i) => <Td key={i} right className="text-xs">{v ? eur(v) : ""}</Td>)}<Td right className="font-medium">{eur(arr.reduce((a, b) => a + b, 0))}</Td></tr>
          ))}
        </tbody>
      </table>
    );
  } else if (r === "suppliers" || r === "brands") {
    const orders = await db.erpDocument.findMany({ where: { type: "ORDER", deleted: false, date: { gte: from, lt: to }, status: { not: "Negalioja / Atmestas" } }, include: { lines: { include: { product: { select: { brand: true } } } } } });
    const suppliers = Object.fromEntries((await db.erpContact.findMany({ where: { category: "Tiekėjas" }, select: { id: true, name: true } })).map((s) => [s.id, s.name]));
    const agg = new Map<string, { net: number; cost: number; qty: number }>();
    for (const o of orders)
      for (const l of o.lines) {
        if (l.priceCents <= 0) continue;
        const k = r === "suppliers" ? (l.supplierId ? (suppliers[l.supplierId] ?? "?") : "Be tiekėjo") : (l.product?.brand ?? "Kita");
        const e = agg.get(k) ?? { net: 0, cost: 0, qty: 0 };
        e.net += Math.round(lineNet(l) * (1 - o.discountPct / 100));
        e.cost += lineCost(l);
        e.qty += l.qty;
        agg.set(k, e);
      }
    const rows = [...agg.entries()].sort((a, b) => b[1].net - a[1].net);
    const max = rows[0]?.[1].net ?? 1;
    body = (
      <table className="w-full text-sm">
        <thead className="bg-zinc-50"><tr><Th>{r === "suppliers" ? "Tiekėjas" : "Gamintojas"}</Th><Th right>Kiekis</Th><Th right>Pardavimai</Th><Th right>Savikaina</Th><Th right>Marža</Th><Th right>Marža %</Th><Th /></tr></thead>
        <tbody>
          {rows.map(([k, e]) => (
            <tr key={k} className="border-t border-zinc-50"><Td>{k}</Td><Td right>{e.qty}</Td><Td right>{eur(e.net)}</Td><Td right>{eur(e.cost)}</Td><Td right>{eur(e.net - e.cost)}</Td><Td right className={e.net && (e.net - e.cost) / e.net < 0.2 ? "text-amber-700" : ""}>{pct(e.net ? ((e.net - e.cost) / e.net) * 100 : 0)}</Td><Td className="w-48"><Bar value={e.net} max={max} /></Td></tr>
          ))}
        </tbody>
      </table>
    );
  } else if (r === "clients") {
    const docs = await revenueDocs(from, to);
    const total = sumNet(docs);
    const agg = new Map<string, { name: string; net: number; open: number; n: number }>();
    for (const d of docs) {
      if (!d.client) continue;
      const e = agg.get(d.client.id) ?? { name: d.client.name, net: 0, open: 0, n: 0 };
      e.net += d.t.net;
      e.open += Math.max(0, d.t.total - d.paid);
      e.n++;
      agg.set(d.client.id, e);
    }
    const rows = [...agg.entries()].sort((a, b) => b[1].net - a[1].net).slice(0, 30);
    body = (
      <table className="w-full text-sm">
        <thead className="bg-zinc-50"><tr><Th>#</Th><Th>Klientas</Th><Th right>Sąskaitų</Th><Th right>Suma be PVM</Th><Th right>Dalis</Th><Th right>Neapmokėta</Th><Th /></tr></thead>
        <tbody>
          {rows.map(([id, e], i) => (
            <tr key={id} className="border-t border-zinc-50"><Td>{i + 1}</Td><Td><Link className="underline" href={`/admin/erp/contacts/${id}`}>{e.name}</Link></Td><Td right>{e.n}</Td><Td right>{eur(e.net)}</Td><Td right>{pct(total ? (e.net / total) * 100 : 0)}</Td><Td right className={e.open ? "text-amber-700" : "text-zinc-400"}>{eur(e.open)}</Td><Td className="w-48"><Bar value={e.net} max={rows[0][1].net} /></Td></tr>
          ))}
        </tbody>
      </table>
    );
  } else if (r === "success") {
    const offers = await db.erpDocument.findMany({ where: { type: "OFFER", deleted: false, date: { gte: from, lt: to } }, include: { lines: true } });
    const byStatus = STATUSES.OFFER.map((s) => {
      const list = offers.filter((o) => o.status === s.key);
      return { s, n: list.length, net: list.reduce((n, o) => n + docTotals(o.lines, o.discountPct).net, 0) };
    });
    const byUser = new Map<string, { won: number; lost: number; open: number }>();
    for (const o of offers) {
      const e = byUser.get(o.managerId ?? "—") ?? { won: 0, lost: 0, open: 0 };
      if (["Užsakytas", "Visiškai įgyvendintas"].includes(o.status)) e.won++;
      else if (STATUSES.OFFER.find((s) => s.key === o.status)?.active) e.open++;
      else e.lost++;
      byUser.set(o.managerId ?? "—", e);
    }
    const max = Math.max(1, ...byStatus.map((b) => b.net));
    body = (
      <div className="grid gap-6 p-2 lg:grid-cols-2">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50"><tr><Th>Būsena</Th><Th right>Kiekis</Th><Th right>Suma</Th><Th /></tr></thead>
          <tbody>{byStatus.map((b) => <tr key={b.s.key} className="border-t border-zinc-50"><Td>{b.s.key}</Td><Td right>{b.n}</Td><Td right>{eur(b.net)}</Td><Td className="w-40"><Bar value={b.net} max={max} className={b.s.success ? "bg-green-600" : b.s.active ? "bg-blue-600" : "bg-zinc-400"} /></Td></tr>)}</tbody>
        </table>
        <table className="w-full text-sm">
          <thead className="bg-zinc-50"><tr><Th>Vadybininkas</Th><Th right>Laimėta</Th><Th right>Prarasta</Th><Th right>Aktyvūs</Th><Th right>Sėkmė</Th></tr></thead>
          <tbody>{[...byUser.entries()].map(([k, e]) => <tr key={k} className="border-t border-zinc-50"><Td>{users[k] ?? "Nepriskirta"}</Td><Td right>{e.won}</Td><Td right>{e.lost}</Td><Td right>{e.open}</Td><Td right>{pct(e.won + e.lost ? (e.won / (e.won + e.lost)) * 100 : 0)}</Td></tr>)}</tbody>
        </table>
      </div>
    );
  } else if (r === "yoy") {
    const [a, b] = await Promise.all([revenueDocs(from, to), revenueDocs(new Date(year - 1, 0, 1), from)]);
    const ma = MONTHS.map((_, i) => sumNet(a.filter((d) => d.date.getMonth() === i)));
    const mb = MONTHS.map((_, i) => sumNet(b.filter((d) => d.date.getMonth() === i)));
    body = (
      <table className="w-full text-sm">
        <thead className="bg-zinc-50"><tr><Th>Mėnuo</Th><Th right>{year}</Th><Th right>{year - 1}</Th><Th right>Pokytis</Th></tr></thead>
        <tbody>
          {MONTHS.map((m, i) => (
            <tr key={m} className="border-t border-zinc-50"><Td>{m}</Td><Td right>{eur(ma[i])}</Td><Td right className="text-zinc-500">{eur(mb[i])}</Td><Td right className={ma[i] >= mb[i] ? "text-green-700" : "text-red-600"}>{mb[i] ? pct(((ma[i] - mb[i]) / mb[i]) * 100) : "—"}</Td></tr>
          ))}
          <tr className="border-t-2 border-zinc-200 font-medium"><Td>Iš viso</Td><Td right>{eur(ma.reduce((x, y) => x + y, 0))}</Td><Td right>{eur(mb.reduce((x, y) => x + y, 0))}</Td><Td /></tr>
        </tbody>
      </table>
    );
  } else {
    const now = new Date();
    const acts = await db.erpActivity.findMany({ where: { start: { gte: new Date(now.getFullYear(), now.getMonth(), 1), lt: new Date(now.getFullYear(), now.getMonth() + 1, 1) } } });
    const byType = new Map<string, { n: number; done: number }>();
    for (const a of acts) {
      const e = byType.get(a.type) ?? { n: 0, done: 0 };
      e.n++;
      if (a.done) e.done++;
      byType.set(a.type, e);
    }
    const rows = [...byType.entries()].sort((x, y) => y[1].n - x[1].n);
    body = (
      <table className="w-full text-sm">
        <thead className="bg-zinc-50"><tr><Th>Veiklos tipas</Th><Th right>Suplanuota</Th><Th right>Atlikta</Th><Th /></tr></thead>
        <tbody>{rows.map(([k, e]) => <tr key={k} className="border-t border-zinc-50"><Td>{k}</Td><Td right>{e.n}</Td><Td right>{e.done}</Td><Td className="w-48"><Bar value={e.n} max={rows[0][1].n} /></Td></tr>)}</tbody>
      </table>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Ataskaitos</h1>
        <div className="flex gap-1 text-sm">{[year - 1, year].map((y) => <Link key={y} href={`?r=${r}&year=${y}`} className={cn("rounded-md px-3 py-1.5", y === year ? "bg-zinc-900 text-white" : "bg-white shadow-sm")}>{y}</Link>)}</div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {REPORTS.map(([k, label]) => <Link key={k} href={`?r=${k}&year=${year}`} className={cn("rounded-full border px-3 py-1 text-xs", r === k ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 bg-white")}>{label}</Link>)}
        <Link href="/admin/erp/commissions" className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs">Architektų ataskaitos →</Link>
      </div>
      <div className="overflow-x-auto rounded-xl bg-white shadow-sm">{body}</div>
    </div>
  );
}
