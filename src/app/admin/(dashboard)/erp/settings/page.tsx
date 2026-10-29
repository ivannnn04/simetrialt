import { db } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { ensureWarehouses } from "@/lib/erp/docs";
import { CONTACT_CATEGORIES, DOC, STATUSES, type DocType } from "@/lib/erp/config";
import { erpCreateDemo, erpDeleteDemo, erpSetCounter } from "@/actions/erp";
import { StatusBadge } from "@/components/erp/ErpUi";
import { ConfirmButton } from "@/components/admin/ConfirmButton";

export const dynamic = "force-dynamic";
// creating the demo data runs the whole order flow ~70 times
export const maxDuration = 300;

export default async function ErpSettings({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  const { msg } = await searchParams;
  await ensureWarehouses();
  const [me, demo, counters, warehouses] = await Promise.all([currentUser(), db.erpDocument.count({ where: { isDemo: true } }), db.erpCounter.findMany({ orderBy: { series: "asc" } }), db.erpWarehouse.findMany({ orderBy: { code: "asc" } })]);
  const admin = me?.role === "ADMIN";
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">ERP nustatymai</h1>
      {msg && <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">{msg}</p>}
      <section className="rounded-xl bg-white p-4 shadow-sm">
        <h2 className="mb-2 font-semibold">Demonstraciniai duomenys</h2>
        <p className="mb-3 max-w-3xl text-sm text-zinc-600">
          Pristatymui: išgalvoti klientai, architektų biurai ir partneriai, tikri katalogo produktai ir gamintojai kaip tiekėjai. Duomenys sukuriami per tikrą procesą
          (pasiūlymas → užsakymas → išankstinė sąskaita → pirkimo užsakymai → priėmimas į sandėlį → sąskaita → mokėjimai → komisinis) per pastaruosius 18 mėn.
          Visi pažymėti kaip demonstraciniai ir ištrinami vienu mygtuku.
        </p>
        {admin ? (
          <div className="flex flex-wrap items-center gap-2">
            {demo === 0 ? (
              <form action={erpCreateDemo}><button className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white">Sukurti demonstracinius duomenis</button></form>
            ) : (
              <>
                <span className="text-sm text-zinc-600">Demonstracinių dokumentų: {demo}</span>
                <form action={erpDeleteDemo}><ConfirmButton type="submit" message="Ištrinti visus demonstracinius ERP duomenis?">Ištrinti demonstracinius duomenis</ConfirmButton></form>
              </>
            )}
          </div>
        ) : <p className="text-sm text-zinc-500">Tik administratorius.</p>}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="mb-2 font-semibold">Numeracijos serijos</h2>
          <p className="mb-2 text-xs text-zinc-500">Po migracijos iš Scoro nustatykite paskutinį numerį – numeracija tęsis toliau.</p>
          <table className="mb-3 w-full text-sm">
            <tbody>
              {Object.entries(DOC).map(([t, d]) => {
                const series = `${d.series}${String(new Date().getFullYear()).slice(2)}`;
                return <tr key={t} className="border-t border-zinc-50"><td className="py-1">{d.label}</td><td className="py-1 font-mono text-xs">{series}-####</td><td className="py-1 text-right text-zinc-500">paskutinis: {counters.find((c) => c.series === series)?.last ?? 0}</td></tr>;
              })}
            </tbody>
          </table>
          {admin && (
            <form action={erpSetCounter} className="flex gap-2 text-sm">
              <input name="series" placeholder="Serija, pvz. SDO26" className="w-40 rounded-md border border-zinc-300 px-2 py-1.5" />
              <input name="last" type="number" placeholder="Paskutinis Nr." className="w-36 rounded-md border border-zinc-300 px-2 py-1.5" />
              <button className="rounded-md border border-zinc-300 px-3 py-1.5">Nustatyti</button>
            </form>
          )}
        </section>
        <section className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="mb-2 font-semibold">Sandėliai</h2>
          <ul className="grid grid-cols-2 gap-1 text-sm">{warehouses.map((w) => <li key={w.id}><span className="font-mono text-xs text-zinc-500">{w.code}</span> {w.name}</li>)}</ul>
          <h2 className="mb-2 mt-4 font-semibold">Kontaktų kategorijos</h2>
          <p className="text-sm text-zinc-600">{CONTACT_CATEGORIES.join(" · ")}</p>
        </section>
      </div>

      <section className="rounded-xl bg-white p-4 shadow-sm">
        <h2 className="mb-3 font-semibold">Būsenos (pagal Scoro auditą)</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(["OFFER", "ORDER", "PURCHASE_ORDER", "INVOICE"] as DocType[]).map((t) => (
            <div key={t}>
              <p className="mb-1 text-xs font-medium uppercase text-zinc-500">{DOC[t].plural}</p>
              <div className="flex flex-wrap gap-1">{STATUSES[t].map((s) => <span key={s.key} title={s.probability != null ? `${s.probability}%` : ""}><StatusBadge type={t} status={s.key} /></span>)}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl bg-white p-4 text-sm shadow-sm">
        <h2 className="mb-2 font-semibold">Migracija iš Scoro (kitas etapas)</h2>
        <p className="text-zinc-600">Scoro API prieiga patikrinta (tik skaitymas). Migracijos eiga: kontaktai → produktai → sandėliai ir likučiai → pasiūlymai → užsakymai → pirkimo užsakymai → sąskaitos ir mokėjimai → pirkimo sąskaitos → veiklos → failai. Kiekviename įraše saugomas Scoro ID, numeracija tęsiama nuo paskutinių Scoro numerių.</p>
      </section>
    </div>
  );
}
