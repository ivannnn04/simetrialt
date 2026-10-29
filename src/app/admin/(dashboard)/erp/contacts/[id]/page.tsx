import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { CONTACT_CATEGORIES, CONTACT_TAGS, DEFAULT_COMMISSION_PCT, DOC, type DocType } from "@/lib/erp/config";
import { docTotals, eur, fmtDate } from "@/lib/erp/money";
import { deleteErpContact, saveErpContact } from "@/actions/erp";
import { StatusBadge } from "@/components/erp/ErpUi";
import { ConfirmButton } from "@/components/admin/ConfirmButton";

export const dynamic = "force-dynamic";

const inp = "mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm";

export default async function ErpContact({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const isNew = id === "new";
  const c = isNew
    ? null
    : await db.erpContact.findUnique({
        where: { id },
        include: {
          people: { where: { deleted: false } },
          company: true,
          clientDocs: { where: { deleted: false }, include: { lines: true }, orderBy: { date: "desc" } },
          partyDocs: { where: { deleted: false }, include: { lines: true }, orderBy: { date: "desc" } },
          supplierDocs: { where: { deleted: false }, include: { lines: true }, orderBy: { date: "desc" } },
          commissions: { include: { document: true }, orderBy: { createdAt: "desc" } },
          activities: { orderBy: { start: "desc" }, take: 20 },
        },
      });
  if (!isNew && !c) notFound();
  const [companies, users] = await Promise.all([
    db.erpContact.findMany({ where: { kind: "COMPANY", deleted: false }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.user.findMany({ select: { id: true, name: true } }),
  ]);
  const docs = c ? [...c.clientDocs, ...c.partyDocs, ...c.supplierDocs].sort((a, b) => b.date.getTime() - a.date.getTime()) : [];
  const invoiced = c ? [...c.clientDocs, ...c.partyDocs].filter((d) => d.type === "INVOICE").reduce((n, d) => n + docTotals(d.lines, d.discountPct).net, 0) : 0;
  const commissionOpen = c?.commissions.filter((x) => x.status !== "PAID").reduce((n, x) => n + x.amountCents, 0) ?? 0;
  const commissionPaid = c?.commissions.filter((x) => x.status === "PAID").reduce((n, x) => n + x.amountCents, 0) ?? 0;

  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-500"><Link href="/admin/erp/contacts" className="hover:underline">← Kontaktai</Link></p>
      <h1 className="text-2xl font-semibold">{c ? c.name : "Naujas kontaktas"}</h1>
      {sp.saved && <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">Išsaugota.</p>}
      <div className="grid gap-4 xl:grid-cols-[1fr_420px]">
        <form action={saveErpContact.bind(null, c?.id ?? null)} className="space-y-4 rounded-xl bg-white p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-3">
            <label className="text-xs text-zinc-500">Tipas
              <select name="kind" defaultValue={c?.kind ?? "COMPANY"} className={inp}><option value="COMPANY">Įmonė</option><option value="PERSON">Asmuo</option></select>
            </label>
            <label className="text-xs text-zinc-500 md:col-span-2">Pavadinimas / vardas, pavardė
              <input name="name" defaultValue={c?.name} required className={inp} />
            </label>
            <label className="text-xs text-zinc-500">Kategorija
              <select name="category" defaultValue={c?.category ?? "Klientas"} className={inp}>{CONTACT_CATEGORIES.map((x) => <option key={x}>{x}</option>)}</select>
            </label>
            <label className="text-xs text-zinc-500">Įmonė (asmeniui)
              <select name="companyId" defaultValue={c?.companyId ?? ""} className={inp}><option value="">—</option>{companies.filter((x) => x.id !== c?.id).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
            </label>
            <label className="text-xs text-zinc-500">Pareigos
              <input name="position" defaultValue={c?.position} className={inp} />
            </label>
            <label className="text-xs text-zinc-500">Įmonės kodas<input name="regCode" defaultValue={c?.regCode} className={inp} /></label>
            <label className="text-xs text-zinc-500">PVM kodas<input name="vatCode" defaultValue={c?.vatCode} className={inp} /></label>
            <label className="text-xs text-zinc-500">Vadybininkas
              <select name="managerId" defaultValue={c?.managerId ?? ""} className={inp}><option value="">—</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
            </label>
            <label className="text-xs text-zinc-500">El. paštas<input name="email" type="email" defaultValue={c?.email} className={inp} /></label>
            <label className="text-xs text-zinc-500">Telefonas<input name="phone" defaultValue={c?.phone} className={inp} /></label>
            <label className="text-xs text-zinc-500">Svetainė<input name="website" defaultValue={c?.website} className={inp} /></label>
            <label className="text-xs text-zinc-500 md:col-span-2">Adresas (sąskaitoms)<input name="address" defaultValue={c?.address} className={inp} /></label>
            <label className="text-xs text-zinc-500">Komisinis, % (architektams)
              <input name="commissionPct" defaultValue={c?.commissionPct ?? ""} placeholder={`numatytasis ${DEFAULT_COMMISSION_PCT}`} className={inp} />
            </label>
            <label className="text-xs text-zinc-500 md:col-span-3">Pristatymo adresas<input name="deliveryAddress" defaultValue={c?.deliveryAddress} className={inp} /></label>
          </div>
          <fieldset>
            <legend className="text-xs text-zinc-500">Žymos</legend>
            <div className="mt-1 flex flex-wrap gap-3">
              {CONTACT_TAGS.map((t) => (
                <label key={t} className="flex items-center gap-1.5 text-sm"><input type="checkbox" name="tags" value={t} defaultChecked={c?.tags.includes(t)} /> {t}</label>
              ))}
            </div>
          </fieldset>
          <label className="block text-xs text-zinc-500">Pastabos<textarea name="notes" rows={3} defaultValue={c?.notes} className={inp} /></label>
          <div className="flex items-center justify-between">
            <button className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white">{c ? "Išsaugoti" : "Sukurti"}</button>
            {c && <ConfirmButton type="submit" formAction={deleteErpContact.bind(null, c.id)} message={`Archyvuoti kontaktą „${c.name}“?`}>Archyvuoti</ConfirmButton>}
          </div>
        </form>

        {c && (
          <aside className="space-y-4">
            <section className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-white p-4 shadow-sm"><p className="text-xs text-zinc-500">Sąskaitos (be PVM)</p><p className="text-xl font-semibold">{eur(invoiced)}</p></div>
              {c.category === "Architektas" || c.category === "Partneris" ? (
                <div className="rounded-xl bg-white p-4 shadow-sm"><p className="text-xs text-zinc-500">Komisiniai: liko / išmokėta</p><p className="text-xl font-semibold">{eur(commissionOpen)}</p><p className="text-xs text-zinc-500">{eur(commissionPaid)} išmokėta</p></div>
              ) : (
                <div className="rounded-xl bg-white p-4 shadow-sm"><p className="text-xs text-zinc-500">Dokumentai</p><p className="text-xl font-semibold">{docs.length}</p></div>
              )}
            </section>
            {c.people.length > 0 && (
              <section className="rounded-xl bg-white p-4 shadow-sm">
                <h2 className="mb-2 text-sm font-semibold">Kontaktiniai asmenys</h2>
                <ul className="space-y-1 text-sm">{c.people.map((p) => <li key={p.id}><Link className="underline" href={`/admin/erp/contacts/${p.id}`}>{p.name}</Link> <span className="text-zinc-500">{p.position} {p.email}</span></li>)}</ul>
              </section>
            )}
            <section className="rounded-xl bg-white p-4 shadow-sm">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-semibold">Dokumentai</h2>
                {c.category !== "Tiekėjas" && <Link href={`/admin/erp/offers/new?type=OFFER`} className="text-xs underline">+ Pasiūlymas</Link>}
              </div>
              <ul className="max-h-96 space-y-1.5 overflow-auto text-sm">
                {docs.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-2">
                    <span>
                      <Link className="underline" href={`/admin/erp/${DOC[d.type as DocType].path}/${d.id}`}>{d.number}</Link>
                      <span className="ml-1 text-xs text-zinc-500">{fmtDate(d.date)} · {eur(docTotals(d.lines, d.discountPct).net)}</span>
                    </span>
                    <StatusBadge type={d.type} status={d.status} />
                  </li>
                ))}
                {docs.length === 0 && <li className="text-zinc-500">Dokumentų nėra.</li>}
              </ul>
            </section>
            {c.activities.length > 0 && (
              <section className="rounded-xl bg-white p-4 shadow-sm">
                <h2 className="mb-2 text-sm font-semibold">Veiklos</h2>
                <ul className="space-y-1 text-sm">{c.activities.map((a) => <li key={a.id} className={a.done ? "text-zinc-400" : ""}>{fmtDate(a.start)} · {a.type}</li>)}</ul>
              </section>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}
