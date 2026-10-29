import Link from "next/link";
import { db } from "@/lib/db";
import { STATUSES, activityGroup, ACTIVITY_GROUP_COLOR } from "@/lib/erp/config";
import { docTotals, eur, fmtDate, pct } from "@/lib/erp/money";
import { markOverdue } from "@/lib/erp/docs";
import { revenueDocs, sumNet, userNames } from "@/lib/erp/queries";
import { Bar, Kpi, Money, StatusBadge } from "@/components/erp/ErpUi";
import { cn } from "@/lib/cn";

export const dynamic = "force-dynamic";

const MONTHS = ["Sau", "Vas", "Kov", "Bal", "Geg", "Bir", "Lie", "Rgp", "Rgs", "Spa", "Lap", "Grd"];
const delta = (a: number, b: number) => (b ? ((a - b) / b) * 100 : 0);

export default async function ErpDashboard() {
  await markOverdue();
  const now = new Date();
  const y = now.getFullYear();
  const m0 = new Date(y, now.getMonth(), 1);
  const m1 = new Date(y, now.getMonth() + 1, 1);
  const pm0 = new Date(y, now.getMonth() - 1, 1);
  const [thisYear, lastYear, offers, openInv, leads, commissions, upcoming, orders, users, docCount] = await Promise.all([
    revenueDocs(new Date(y, 0, 1), new Date(y + 1, 0, 1)),
    revenueDocs(new Date(y - 1, 0, 1), new Date(y, 0, 1)),
    db.erpDocument.findMany({ where: { type: "OFFER", deleted: false }, include: { lines: true, client: { select: { name: true } } }, orderBy: { date: "desc" } }),
    db.erpDocument.findMany({ where: { type: { in: ["INVOICE", "PREPAYMENT"] }, deleted: false, status: { in: ["Neapmokėta", "Dalinai apmokėta", "Vėluoja"] } }, include: { lines: true, payments: true, client: { select: { name: true } } }, orderBy: { dueDate: "asc" } }),
    db.lead.count({ where: { createdAt: { gte: m0 } } }),
    db.erpCommission.aggregate({ where: { status: { not: "PAID" } }, _sum: { amountCents: true } }),
    db.erpActivity.findMany({ where: { done: false, start: { gte: new Date(now.getTime() - 864e5) } }, orderBy: { start: "asc" }, take: 8, include: { contact: { select: { name: true } } } }),
    db.erpDocument.groupBy({ by: ["status"], where: { type: "ORDER", deleted: false }, _count: true }),
    userNames(),
    db.erpDocument.count(),
  ]);
  const revMonth = sumNet(thisYear.filter((d) => d.date >= m0 && d.date < m1));
  const revPrevMonth = sumNet([...thisYear, ...lastYear].filter((d) => d.date >= pm0 && d.date < m0));
  const ytd = sumNet(thisYear.filter((d) => d.date <= now));
  const lastYtdCut = new Date(y - 1, now.getMonth(), now.getDate());
  const lastYtd = sumNet(lastYear.filter((d) => d.date <= lastYtdCut));
  const offersT = offers.map((o) => ({ ...o, t: docTotals(o.lines, o.discountPct) }));
  const won = offersT.filter((o) => ["Užsakytas", "Visiškai įgyvendintas"].includes(o.status));
  const lost = offersT.filter((o) => ["Atmestas", "Pasirinko konkurentą", "Analogas", "Nebegalioja"].includes(o.status));
  const conversion = won.length + lost.length ? (won.length / (won.length + lost.length)) * 100 : 0;
  const wonMonth = won.filter((o) => o.updatedAt >= m0);
  const closingMonth = offersT.filter((o) => ["Domisi", "Derinamas", "Protekcija"].includes(o.status) && o.validUntil && o.validUntil >= m0 && o.validUntil < m1);
  const openTotal = openInv.reduce((n, d) => n + docTotals(d.lines, d.discountPct).total - d.payments.reduce((a, p) => a + p.amountCents, 0), 0);
  const monthly = (docs: typeof thisYear) => MONTHS.map((_, i) => sumNet(docs.filter((d) => d.date.getMonth() === i)));
  const mThis = monthly(thisYear);
  const mLast = monthly(lastYear);
  const maxM = Math.max(1, ...mThis, ...mLast);
  const clients = new Map<string, { name: string; net: number }>();
  for (const d of thisYear) if (d.client) clients.set(d.client.id, { name: d.client.name, net: (clients.get(d.client.id)?.net ?? 0) + d.t.net });
  const top = [...clients.entries()].sort((a, b) => b[1].net - a[1].net).slice(0, 8);
  const ordersBy = Object.fromEntries(orders.map((o) => [o.status, o._count]));

  if (docCount === 0) {
    return (
      <div className="rounded-xl bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold">ERP dar tuščias</h1>
        <p className="mx-auto mt-2 max-w-xl text-sm text-zinc-600">Sukurkite pirmąjį pasiūlymą arba įkelkite demonstracinius duomenis, kad pamatytumėte visą procesą: pasiūlymas → užsakymas → išankstinė sąskaita → pirkimo užsakymai → sandėlis → sąskaita → mokėjimai → architekto komisinis.</p>
        <div className="mt-4 flex justify-center gap-2">
          <Link href="/admin/erp/offers/new" className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-white">+ Pasiūlymas</Link>
          <Link href="/admin/erp/settings" className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm">Demonstraciniai duomenys</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">Pardavimų apžvalga</h1>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Naujos užklausos (mėn.)" value={String(leads)} href="/admin/leads" />
        <Kpi label="Užsidaro šį mėn." value={String(closingMonth.length)} sub={eur(closingMonth.reduce((n, o) => n + o.t.net, 0))} href="/admin/erp/offers" />
        <Kpi label="Sėkmingi pasiūlymai (mėn.)" value={eur(wonMonth.reduce((n, o) => n + o.t.net, 0))} sub={`${wonMonth.length} vnt.`} />
        <Kpi label="Konversija" value={pct(conversion)} sub={`${won.length} laimėta / ${lost.length} prarasta`} />
        <Kpi label="Pajamos šį mėn." value={eur(revMonth)} sub={`${delta(revMonth, revPrevMonth) >= 0 ? "▲" : "▼"} ${pct(Math.abs(delta(revMonth, revPrevMonth)))} vs praeitas`} tone={revMonth >= revPrevMonth ? "up" : "down"} />
        <Kpi label={`Pajamos ${y} YTD`} value={eur(ytd)} sub={`${delta(ytd, lastYtd) >= 0 ? "▲" : "▼"} ${pct(Math.abs(delta(ytd, lastYtd)))} vs ${y - 1} YTD`} tone={ytd >= lastYtd ? "up" : "down"} />
        <Kpi label="Neapmokėtos sąskaitos" value={eur(openTotal)} sub={`${openInv.filter((d) => d.status === "Vėluoja").length} vėluoja`} tone={openInv.some((d) => d.status === "Vėluoja") ? "down" : undefined} href="/admin/erp/invoices?status=Neapmokėta&status=Dalinai+apmokėta&status=Vėluoja" />
        <Kpi label="Neišmokėti komisiniai" value={eur(commissions._sum.amountCents ?? 0)} href="/admin/erp/commissions" />
      </div>

      <section className="rounded-xl bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">Pasiūlymų piltuvas</h2><Link href="/admin/erp/offers" className="text-sm underline">Visi pasiūlymai</Link></div>
        <div className="flex gap-3 overflow-x-auto pb-1">
          {STATUSES.OFFER.map((s) => {
            const col = offersT.filter((o) => o.status === s.key);
            return (
              <div key={s.key} className={cn("w-56 shrink-0 rounded-lg border p-2", s.active ? "border-zinc-300 bg-zinc-50" : "border-zinc-100")}>
                <div className="mb-2 flex items-center justify-between"><StatusBadge type="OFFER" status={s.key} /><span className="text-xs text-zinc-500">{col.length}</span></div>
                <p className="mb-2 text-sm font-semibold tabular-nums">{eur(col.reduce((n, o) => n + o.t.net, 0))}</p>
                <ul className="space-y-1">
                  {col.slice(0, 4).map((o) => (
                    <li key={o.id}><Link href={`/admin/erp/offers/${o.id}`} className="block rounded bg-white px-2 py-1 text-xs shadow-sm hover:bg-zinc-100"><span className="font-medium">{o.number}</span> · {o.client?.name}<span className="block tabular-nums text-zinc-500">{eur(o.t.net)}</span></Link></li>
                  ))}
                  {col.length > 4 && <li className="text-center text-[11px] text-zinc-400">+{col.length - 4}</li>}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <section className="rounded-xl bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Pajamos be PVM: {y} ir {y - 1}</h2>
            <span className="flex gap-3 text-xs"><span className="flex items-center gap-1"><i className="inline-block h-2 w-3 bg-zinc-900" />{y}</span><span className="flex items-center gap-1"><i className="inline-block h-2 w-3 bg-zinc-300" />{y - 1}</span></span>
          </div>
          <div className="flex h-56 items-end gap-2">
            {MONTHS.map((mn, i) => (
              <div key={mn} className="flex h-full flex-1 flex-col justify-end">
                <div className="flex h-full items-end justify-center gap-0.5">
                  <div title={`${mn} ${y - 1}: ${eur(mLast[i])}`} className="w-1/2 rounded-t bg-zinc-300" style={{ height: `${(mLast[i] / maxM) * 100}%` }} />
                  <div title={`${mn} ${y}: ${eur(mThis[i])}`} className="w-1/2 rounded-t bg-zinc-900" style={{ height: `${(mThis[i] / maxM) * 100}%` }} />
                </div>
                <p className="mt-1 text-center text-[11px] text-zinc-500">{mn}</p>
              </div>
            ))}
          </div>
        </section>
        <section className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="mb-3 font-semibold">TOP klientai {y}</h2>
          <ul className="space-y-2 text-sm">
            {top.map(([id, c]) => (
              <li key={id}>
                <div className="flex justify-between gap-2"><Link href={`/admin/erp/contacts/${id}`} className="truncate underline">{c.name}</Link><span className="shrink-0 tabular-nums">{eur(c.net)} <span className="text-xs text-zinc-400">{pct(ytd ? (c.net / ytd) * 100 : 0)}</span></span></div>
                <Bar value={c.net} max={top[0]?.[1].net ?? 1} />
              </li>
            ))}
            {top.length === 0 && <li className="text-zinc-500">Šiais metais sąskaitų dar nėra.</li>}
          </ul>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="mb-3 font-semibold">Užsakymai pagal būseną</h2>
          <ul className="space-y-1 text-sm">
            {STATUSES.ORDER.filter((s) => ordersBy[s.key]).map((s) => (
              <li key={s.key} className="flex items-center justify-between"><Link href={`/admin/erp/orders?status=${encodeURIComponent(s.key)}`}><StatusBadge type="ORDER" status={s.key} /></Link><span className="tabular-nums">{ordersBy[s.key]}</span></li>
            ))}
          </ul>
        </section>
        <section className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="mb-3 font-semibold">Neapmokėtos sąskaitos</h2>
          <ul className="space-y-1.5 text-sm">
            {openInv.slice(0, 8).map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate"><Link className="underline" href={`/admin/erp/invoices/${d.id}`}>{d.number}</Link> <span className="text-zinc-500">{d.client?.name}</span></span>
                <span className={cn("shrink-0 text-xs", d.status === "Vėluoja" ? "text-red-600" : "text-zinc-500")}>{fmtDate(d.dueDate)} · <Money cents={docTotals(d.lines, d.discountPct).total - d.payments.reduce((a, p) => a + p.amountCents, 0)} /></span>
              </li>
            ))}
            {openInv.length === 0 && <li className="text-zinc-500">Visos sąskaitos apmokėtos.</li>}
          </ul>
        </section>
        <section className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="mb-3 font-semibold">Artimiausios veiklos</h2>
          <ul className="space-y-1.5 text-sm">
            {upcoming.map((a) => (
              <li key={a.id} className="flex items-start gap-2">
                <span className={cn("mt-0.5 shrink-0 rounded px-1 text-[10px]", ACTIVITY_GROUP_COLOR[activityGroup(a.type)])}>{fmtDate(a.start).slice(5)}</span>
                <span className="min-w-0"><span className="block truncate">{a.title}</span><span className="text-xs text-zinc-500">{a.userIds.map((u) => users[u]).filter(Boolean).join(", ")}</span></span>
              </li>
            ))}
          </ul>
          <Link href="/admin/erp/calendar" className="mt-2 inline-block text-sm underline">Kalendorius</Link>
        </section>
      </div>
    </div>
  );
}
