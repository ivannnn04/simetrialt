import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { DOC, PATH_TYPES, PAYMENT_METHODS, STATUSES, defaultStatus, statusDef, type DocType } from "@/lib/erp/config";
import { amountInWords, docTotals, eur, fmtDate } from "@/lib/erp/money";
import { erpComment, erpConvert, erpDelete, erpPayment, erpReceive, setCommissionStatus, setErpStatusForm } from "@/actions/erp";
import { DocEditor } from "@/components/erp/DocEditor";
import { StatusBadge } from "@/components/erp/ErpUi";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import type { DocInput } from "@/actions/erp";

export const dynamic = "force-dynamic";

const btn = "rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm hover:bg-zinc-50";
const btnDark = "rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700";

/** today + n days (outside render: keeps components pure) */
const inDays = (n: number) => new Date(Date.now() + n * 864e5);

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export default async function ErpDocPage({ params, searchParams }: { params: Promise<{ kind: string; id: string }>; searchParams: Promise<{ type?: string }> }) {
  const [{ kind, id }, sp] = await Promise.all([params, searchParams]);
  const types = PATH_TYPES[kind] as DocType[] | undefined;
  if (!types) notFound();
  const isNew = id === "new";
  const doc = isNew
    ? null
    : await db.erpDocument.findUnique({
        where: { id },
        include: {
          lines: { orderBy: { sort: "asc" } },
          payments: { orderBy: { date: "asc" } },
          parent: true,
          children: { where: { deleted: false }, include: { lines: true, payments: true }, orderBy: { createdAt: "asc" } },
          commissions: { include: { architect: true } },
          activities: { orderBy: { start: "desc" } },
          events: { orderBy: { createdAt: "desc" }, take: 50 },
          client: true,
          party: true,
          supplier: true,
        },
      });
  if (!isNew && !doc) notFound();
  const type = (doc?.type ?? (types.includes(sp.type as DocType) ? sp.type : types[0])) as DocType;
  const meta = DOC[type];

  const [contacts, users, warehouses] = await Promise.all([
    db.erpContact.findMany({ where: { deleted: false }, select: { id: true, name: true, category: true }, orderBy: { name: "asc" } }),
    db.user.findMany({ where: { role: { in: ["ADMIN", "EDITOR"] } }, select: { id: true, name: true } }),
    db.erpWarehouse.findMany({ orderBy: { code: "asc" } }),
  ]);
  const clients = contacts.filter((c) => !["Tiekėjas", "Vežėjai"].includes(c.category));
  const parties = contacts.filter((c) => ["Architektas", "Partneris", "Agentas"].includes(c.category));
  const suppliers = contacts.filter((c) => c.category === "Tiekėjas");

  const d8 = (x: Date | null | undefined) => (x ? fmtDate(x) : "");
  const initial: DocInput = {
    date: d8(doc?.date ?? new Date()),
    dueDate: d8(doc?.dueDate ?? (["INVOICE", "PREPAYMENT", "PURCHASE_INVOICE"].includes(type) ? inDays(14) : null)),
    validUntil: d8(doc?.validUntil ?? (type === "OFFER" ? inDays(30) : null)),
    status: doc?.status ?? defaultStatus(type),
    clientId: doc?.clientId ?? "",
    partyId: doc?.partyId ?? "",
    supplierId: doc?.supplierId ?? "",
    channel: doc?.channel ?? "Be architekto",
    managerId: doc?.managerId ?? "",
    probability: doc?.probability ?? statusDef(type, defaultStatus(type)).probability ?? null,
    discountPct: doc?.discountPct ?? 0,
    advancePct: doc?.advancePct ?? 30,
    deliveryTerm: doc?.deliveryTerm ?? "",
    contractText: doc?.contractText ?? "",
    note: doc?.note ?? "",
    lines: (doc?.lines ?? []).map((l) => ({ ...l, sourceLineId: l.sourceLineId })),
  };
  const t = doc ? docTotals(doc.lines, doc.discountPct) : null;
  const paid = doc?.payments.reduce((n, p) => n + p.amountCents, 0) ?? 0;
  const hasChild = (ty: DocType) => doc?.children.some((c) => c.type === ty) ?? false;
  const printVariants: [string, string][] =
    type === "OFFER"
      ? [["standard", "Pasiūlymas"], ["no-discount", "Be nuolaidos eilutės"], ["partners", "PARTNERIŲ pasiūlymas"]]
      : type === "ORDER"
        ? [["contract", "Užsakymo sutartis"], ["no-discount", "Be nuolaidos"], ["act", "Priėmimo–perdavimo aktas"]]
        : type === "PURCHASE_ORDER"
          ? [["no-prices", "Be kainų"], ["standard", "Su kainomis"]]
          : type === "INVOICE" || type === "PREPAYMENT" || type === "CREDIT"
            ? [["standard", "Sąskaita"], ["no-discount", "Be nuolaidos"], ["waybill", "Važtaraštis"], ["act", "Perdavimo aktas"], ["kpo", "KPO"], ["en", "English invoice"]]
            : [["standard", "Dokumentas"]];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-zinc-500">
            <Link href={`/admin/erp/${kind}`} className="hover:underline">← {kind === "invoices" ? "Sąskaitos" : meta.plural}</Link>
          </p>
          <h1 className="flex items-center gap-3 text-2xl font-semibold">
            {doc ? `${meta.label} ${doc.number}` : `Naujas: ${meta.label.toLowerCase()}`}
            {doc && <StatusBadge type={type} status={doc.status} />}
          </h1>
          {doc && (
            <p className="mt-1 text-sm text-zinc-500">
              {(doc.client ?? doc.supplier)?.name ?? "—"}
              {doc.party && <> · {doc.party.category}: {doc.party.name}</>}
              {doc.parent && (
                <> · iš <Link className="underline" href={`/admin/erp/${DOC[doc.parent.type as DocType].path}/${doc.parent.id}`}>{doc.parent.number}</Link></>
              )}
            </p>
          )}
        </div>
        {doc && (
          <div className="flex flex-wrap items-center gap-2">
            {type === "OFFER" && !hasChild("ORDER") && <form action={erpConvert.bind(null, doc.id, "order")}><button className={btnDark}>Sukurti užsakymą</button></form>}
            {type === "ORDER" && (
              <>
                <form action={erpConvert.bind(null, doc.id, "prepayment")}><button className={btn}>Išankstinė sąskaita ({doc.advancePct}%)</button></form>
                <form action={erpConvert.bind(null, doc.id, "purchase-orders")}><button className={btn}>Pirkimo užsakymai</button></form>
                <form action={erpConvert.bind(null, doc.id, "invoice")}><button className={btnDark}>Galutinė sąskaita</button></form>
              </>
            )}
            {type === "INVOICE" && <form action={erpConvert.bind(null, doc.id, "credit")}><button className={btn}>Kreditinė sąskaita</button></form>}
            <form action={erpConvert.bind(null, doc.id, "copy")}><button className={btn}>Kopijuoti</button></form>
            <details className="relative">
              <summary className={`${btn} cursor-pointer list-none`}>PDF / spausdinti ▾</summary>
              <div className="absolute right-0 z-20 mt-1 w-56 rounded-md border border-zinc-200 bg-white py-1 shadow-lg">
                {printVariants.map(([v, label]) => (
                  <a key={v} href={`/admin/erp-print/${doc.id}?v=${v}`} target="_blank" className="block px-3 py-1.5 text-sm hover:bg-zinc-50">{label}</a>
                ))}
              </div>
            </details>
            <form action={erpDelete.bind(null, doc.id)}>
              <ConfirmButton type="submit" message={`Archyvuoti ${doc.number}? Dokumentas neištrinamas – lieka žurnale.`}>Archyvuoti</ConfirmButton>
            </form>
          </div>
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <DocEditor id={doc?.id ?? null} type={type} initial={initial} clients={clients} parties={parties} suppliers={suppliers} users={users} />

        {doc && (
          <aside className="space-y-4">
            <Panel title="Greitas būsenos keitimas">
              <form action={setErpStatusForm.bind(null, doc.id)} className="flex gap-2">
                <select name="status" defaultValue={doc.status} className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm">
                  {STATUSES[type].map((s) => <option key={s.key}>{s.key}</option>)}
                </select>
                <button className={btn}>OK</button>
              </form>
            </Panel>

            {(doc.parent || doc.children.length > 0) && (
              <Panel title="Susiję dokumentai">
                <ul className="space-y-1.5 text-sm">
                  {doc.parent && (
                    <li className="flex items-center justify-between gap-2">
                      <Link className="underline" href={`/admin/erp/${DOC[doc.parent.type as DocType].path}/${doc.parent.id}`}>{DOC[doc.parent.type as DocType].label} {doc.parent.number}</Link>
                      <StatusBadge type={doc.parent.type} status={doc.parent.status} />
                    </li>
                  )}
                  {doc.children.map((c) => {
                    const ct = docTotals(c.lines, c.discountPct);
                    return (
                      <li key={c.id} className="flex items-center justify-between gap-2">
                        <span>
                          <Link className="underline" href={`/admin/erp/${DOC[c.type as DocType].path}/${c.id}`}>{DOC[c.type as DocType].label} {c.number}</Link>
                          <span className="ml-1 text-xs text-zinc-500">{eur(ct.total)}</span>
                        </span>
                        <StatusBadge type={c.type} status={c.status} />
                      </li>
                    );
                  })}
                </ul>
              </Panel>
            )}

            {type === "PURCHASE_ORDER" && doc.lines.some((l) => l.receivedQty < l.qty) && (
              <Panel title="Prekių priėmimas į sandėlį">
                <form action={erpReceive.bind(null, doc.id)} className="space-y-2 text-sm">
                  <select name="warehouseId" className="w-full rounded-md border border-zinc-300 px-2 py-1.5">
                    {warehouses.map((w) => <option key={w.id} value={w.id}>{w.code} — {w.name}</option>)}
                  </select>
                  {doc.lines.filter((l) => l.receivedQty < l.qty).map((l) => (
                    <label key={l.id} className="flex items-center justify-between gap-2">
                      <span className="min-w-0 flex-1 truncate">{l.name}</span>
                      <input type="number" step="any" name={`q_${l.id}`} defaultValue={l.qty - l.receivedQty} min={0} max={l.qty - l.receivedQty} className="w-20 rounded-md border border-zinc-300 px-2 py-1 text-right" />
                    </label>
                  ))}
                  <button className={btnDark}>Priimti prekes</button>
                </form>
              </Panel>
            )}

            {["INVOICE", "PREPAYMENT", "PURCHASE_INVOICE"].includes(type) && t && (
              <Panel title="Mokėjimai (gavimai)">
                <dl className="mb-3 grid grid-cols-2 gap-1 text-sm">
                  <dt className="text-zinc-500">Suma su PVM</dt><dd className="text-right tabular-nums">{eur(t.total)}</dd>
                  <dt className="text-zinc-500">Apmokėta</dt><dd className="text-right tabular-nums">{eur(paid)}</dd>
                  <dt className="font-medium">Liko mokėti</dt><dd className="text-right font-medium tabular-nums">{eur(Math.max(0, t.total - paid))}</dd>
                </dl>
                <p className="mb-2 text-xs text-zinc-500">{amountInWords(t.total)}</p>
                <ul className="mb-3 space-y-1 text-sm">
                  {doc.payments.map((p) => (
                    <li key={p.id} className="flex justify-between"><span className="text-zinc-500">{fmtDate(p.date)} · {p.method}</span><span className="tabular-nums">{eur(p.amountCents)}</span></li>
                  ))}
                </ul>
                {t.total - paid > 0 && (
                  <form action={erpPayment.bind(null, doc.id)} className="grid grid-cols-2 gap-2 text-sm">
                    <input name="amount" defaultValue={((t.total - paid) / 100).toFixed(2)} className="rounded-md border border-zinc-300 px-2 py-1 text-right" />
                    <input type="date" name="date" defaultValue={fmtDate(new Date())} className="rounded-md border border-zinc-300 px-2 py-1" />
                    <select name="method" className="col-span-2 rounded-md border border-zinc-300 px-2 py-1">{PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}</select>
                    <button className={`${btnDark} col-span-2`}>Registruoti mokėjimą</button>
                  </form>
                )}
              </Panel>
            )}

            {doc.commissions.length > 0 && (
              <Panel title="Architekto komisinis">
                {doc.commissions.map((c) => (
                  <div key={c.id} className="space-y-2 text-sm">
                    <p>{c.architect.name}: <b>{eur(c.amountCents)}</b> <span className="text-zinc-500">({c.pct}% nuo {eur(c.baseCents)})</span></p>
                    <p className="text-xs text-zinc-500">Būsena: {c.status === "PAID" ? `išmokėta ${fmtDate(c.paidAt)}` : c.status === "APPROVED" ? "patvirtinta" : "priskaičiuota"}</p>
                    {c.status !== "PAID" && (
                      <div className="flex gap-2">
                        {c.status === "ACCRUED" && <form action={setCommissionStatus.bind(null, c.id, "APPROVED")}><button className={btn}>Patvirtinti</button></form>}
                        <form action={setCommissionStatus.bind(null, c.id, "PAID")}><button className={btnDark}>Pažymėti išmokėtu</button></form>
                      </div>
                    )}
                  </div>
                ))}
              </Panel>
            )}

            {doc.activities.length > 0 && (
              <Panel title="Veiklos">
                <ul className="space-y-1 text-sm">
                  {doc.activities.map((a) => <li key={a.id} className={a.done ? "text-zinc-400 line-through" : ""}>{fmtDate(a.start)} · {a.title}</li>)}
                </ul>
              </Panel>
            )}

            <Panel title="Komentarai ir veiksmų žurnalas">
              <form action={erpComment.bind(null, doc.id)} className="mb-3 flex gap-2">
                <input name="text" placeholder="Komentaras… (@vardas)" className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm" />
                <button className={btn}>Rašyti</button>
              </form>
              <ul className="max-h-80 space-y-2 overflow-auto text-xs">
                {doc.events.map((e) => (
                  <li key={e.id} className={e.kind === "COMMENT" ? "rounded-md bg-amber-50 p-2" : "text-zinc-500"}>
                    <span className="text-zinc-400">{e.createdAt.toLocaleString("lt-LT")} {e.userName && `· ${e.userName}`}</span>
                    <br />
                    {e.text}
                  </li>
                ))}
              </ul>
            </Panel>
          </aside>
        )}
      </div>
    </div>
  );
}
