import Link from "next/link";
import { db } from "@/lib/db";
import { ACTIVITY_GROUP_COLOR, ACTIVITY_TYPES, activityGroup } from "@/lib/erp/config";
import { fmtDate } from "@/lib/erp/money";
import { saveErpActivity, toggleErpActivity } from "@/actions/erp";
import { cn } from "@/lib/cn";

export const dynamic = "force-dynamic";

const recent = (a: { done: boolean; start: Date }) => !a.done && a.start.getTime() >= Date.now() - 864e5;
const WEEKDAYS = ["Pr", "An", "Tr", "Kt", "Pn", "Št", "Sk"];
const MONTHS = ["Sausis", "Vasaris", "Kovas", "Balandis", "Gegužė", "Birželis", "Liepa", "Rugpjūtis", "Rugsėjis", "Spalis", "Lapkritis", "Gruodis"];

export default async function ErpCalendar({ searchParams }: { searchParams: Promise<{ m?: string; user?: string; group?: string }> }) {
  const f = await searchParams;
  const base = f.m ? new Date(`${f.m}-01T00:00:00`) : new Date();
  const first = new Date(base.getFullYear(), base.getMonth(), 1);
  const gridStart = new Date(first);
  gridStart.setDate(1 - ((first.getDay() + 6) % 7));
  const gridEnd = new Date(gridStart.getTime() + 42 * 864e5);
  const [activities, users, contacts] = await Promise.all([
    db.erpActivity.findMany({ where: { start: { gte: gridStart, lt: gridEnd }, ...(f.user ? { userIds: { has: f.user } } : {}) }, include: { contact: { select: { name: true } } }, orderBy: { start: "asc" } }),
    db.user.findMany({ where: { role: { in: ["ADMIN", "EDITOR"] } }, select: { id: true, name: true } }),
    db.erpContact.findMany({ where: { deleted: false, category: { not: "Tiekėjas" } }, select: { id: true, name: true }, orderBy: { name: "asc" }, take: 500 }),
  ]);
  const shown = f.group ? activities.filter((a) => activityGroup(a.type) === f.group) : activities;
  const ym = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const prev = new Date(first.getFullYear(), first.getMonth() - 1, 1);
  const next = new Date(first.getFullYear(), first.getMonth() + 1, 1);
  const days = Array.from({ length: 42 }, (_, i) => new Date(gridStart.getTime() + i * 864e5));
  const today = fmtDate(new Date());
  const q = (patch: Record<string, string | undefined>) => `?${new URLSearchParams(Object.entries({ ...f, ...patch }).filter(([, v]) => v) as [string, string][])}`;
  const upcoming = activities.filter(recent).slice(0, 12);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Kalendorius — {MONTHS[first.getMonth()]} {first.getFullYear()}</h1>
        <div className="flex items-center gap-2 text-sm">
          <Link href={q({ m: ym(prev) })} className="rounded-md bg-white px-3 py-1.5 shadow-sm">←</Link>
          <Link href={q({ m: undefined })} className="rounded-md bg-white px-3 py-1.5 shadow-sm">Šiandien</Link>
          <Link href={q({ m: ym(next) })} className="rounded-md bg-white px-3 py-1.5 shadow-sm">→</Link>
          <form className="flex gap-1">
            {f.m && <input type="hidden" name="m" value={f.m} />}
            <select name="user" defaultValue={f.user ?? ""} className="rounded-md border border-zinc-300 px-2 py-1.5"><option value="">Visi vartotojai</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
            <select name="group" defaultValue={f.group ?? ""} className="rounded-md border border-zinc-300 px-2 py-1.5"><option value="">Visi tipai</option>{Object.keys(ACTIVITY_TYPES).map((g) => <option key={g}>{g}</option>)}</select>
            <button className="rounded-md bg-zinc-900 px-3 py-1.5 text-white">Rodyti</button>
          </form>
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <div className="overflow-hidden rounded-xl bg-white shadow-sm">
          <div className="grid grid-cols-7 border-b border-zinc-100 bg-zinc-50 text-center text-xs text-zinc-500">{WEEKDAYS.map((d) => <div key={d} className="py-2">{d}</div>)}</div>
          <div className="grid grid-cols-7">
            {days.map((d) => {
              const key = fmtDate(new Date(d.getTime() - d.getTimezoneOffset() * 60e3));
              const items = shown.filter((a) => fmtDate(new Date(a.start.getTime() - a.start.getTimezoneOffset() * 60e3)) === key);
              return (
                <div key={key} className={cn("min-h-[110px] border-b border-r border-zinc-100 p-1.5", d.getMonth() !== first.getMonth() && "bg-zinc-50/60")}>
                  <p className={cn("mb-1 text-xs", key === today ? "inline-block rounded-full bg-zinc-900 px-1.5 text-white" : "text-zinc-500")}>{d.getDate()}</p>
                  <ul className="space-y-0.5">
                    {items.slice(0, 4).map((a) => (
                      <li key={a.id} title={`${a.type}${a.contact ? ` · ${a.contact.name}` : ""}`} className={cn("truncate rounded px-1 py-0.5 text-[11px]", ACTIVITY_GROUP_COLOR[activityGroup(a.type)], a.done && "line-through opacity-60")}>
                        {a.allDay ? "" : `${a.start.toTimeString().slice(0, 5)} `}{a.title}
                      </li>
                    ))}
                    {items.length > 4 && <li className="text-[11px] text-zinc-500">+{items.length - 4}</li>}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
        <aside className="space-y-4">
          <form action={saveErpActivity} className="space-y-2 rounded-xl bg-white p-4 text-sm shadow-sm">
            <h2 className="font-semibold">Nauja veikla</h2>
            <select name="type" className="w-full rounded-md border border-zinc-300 px-2 py-1.5">
              {Object.entries(ACTIVITY_TYPES).map(([g, ts]) => <optgroup key={g} label={g}>{ts.map((t) => <option key={t}>{t}</option>)}</optgroup>)}
            </select>
            <input name="title" placeholder="Pavadinimas (nebūtina)" className="w-full rounded-md border border-zinc-300 px-2 py-1.5" />
            <div className="grid grid-cols-3 gap-1">
              <input type="date" name="date" defaultValue={today} className="col-span-2 rounded-md border border-zinc-300 px-2 py-1.5" />
              <input type="time" name="time" defaultValue="10:00" className="rounded-md border border-zinc-300 px-2 py-1.5" />
            </div>
            <select name="minutes" defaultValue="60" className="w-full rounded-md border border-zinc-300 px-2 py-1.5">{[30, 60, 90, 120, 240, 480].map((m) => <option key={m} value={m}>{m} min.</option>)}</select>
            <select name="contactId" className="w-full rounded-md border border-zinc-300 px-2 py-1.5"><option value="">Kontaktas…</option>{contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
            <select name="userId" className="w-full rounded-md border border-zinc-300 px-2 py-1.5">{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
            <input name="location" placeholder="Vieta" className="w-full rounded-md border border-zinc-300 px-2 py-1.5" />
            <button className="w-full rounded-md bg-zinc-900 px-3 py-2 font-medium text-white">Sukurti</button>
          </form>
          <section className="rounded-xl bg-white p-4 shadow-sm">
            <h2 className="mb-2 text-sm font-semibold">Artimiausios veiklos</h2>
            <ul className="space-y-1.5 text-xs">
              {upcoming.map((a) => (
                <li key={a.id} className="flex items-start gap-2">
                  <form action={toggleErpActivity.bind(null, a.id)}><button className="mt-0.5 h-3.5 w-3.5 rounded border border-zinc-400" aria-label="Atlikta" /></form>
                  <span><span className="text-zinc-400">{fmtDate(a.start)} {a.start.toTimeString().slice(0, 5)}</span> {a.title}</span>
                </li>
              ))}
              {upcoming.length === 0 && <li className="text-zinc-500">Suplanuotų veiklų nėra.</li>}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
