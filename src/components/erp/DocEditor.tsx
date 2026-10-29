"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { erpSearchProducts, saveErpDocument, type DocInput, type ProductOption } from "@/actions/erp";
import { CHANNELS, DELIVERY_TERMS, DOC, STATUSES, statusDef, type DocType } from "@/lib/erp/config";
import { docTotals, eur, lineNet, pct } from "@/lib/erp/money";
import type { LineInput } from "@/lib/erp/docs";
import { cn } from "@/lib/cn";

type Opt = { id: string; name: string };
type Line = LineInput & { key: string };

const inp = "w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm focus:border-zinc-500 focus:outline-none";
const toEur = (c: number) => (c / 100).toFixed(2);
const fromEur = (s: string) => Math.round((Number(s.replace(/\s/g, "").replace(",", ".")) || 0) * 100);

function Lbl({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("block text-xs text-zinc-500", className)}>
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}

/** Editable money cell: keeps what is typed until it loses focus. */
function MoneyInput({ cents, onChange, className }: { cents: number; onChange: (c: number) => void; className?: string }) {
  // text only while the field is being edited; otherwise the formatted value
  const [text, setText] = useState<string | null>(null);
  return (
    <input
      inputMode="decimal"
      className={cn(inp, "text-right", className)}
      value={text ?? toEur(cents)}
      onFocus={() => setText(toEur(cents))}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        if (text != null) onChange(fromEur(text));
        setText(null);
      }}
    />
  );
}

export function DocEditor(props: {
  id: string | null;
  type: DocType;
  initial: DocInput;
  clients: Opt[];
  parties: Opt[];
  suppliers: Opt[];
  users: Opt[];
  locked?: boolean;
}) {
  const { type } = props;
  const meta = DOC[type];
  const router = useRouter();
  const [form, setForm] = useState<DocInput>(props.initial);
  const [lines, setLines] = useState<Line[]>(props.initial.lines.map((l, i) => ({ ...l, key: `l${i}` })));
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState<{ ok?: string; error?: string } | null>(null);
  const [saving, startSave] = useTransition();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<ProductOption[]>([]);
  const [, startSearch] = useTransition();
  const isSale = meta.counterparty === "client";
  const showCost = meta.withCost || type === "PURCHASE_ORDER";

  useEffect(() => {
    const t = setTimeout(() => {
      if (q.trim().length < 2) setHits([]);
      else startSearch(async () => setHits(await erpSearchProducts(q)));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const set = <K extends keyof DocInput>(k: K, v: DocInput[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setDirty(true);
  };
  const patch = (key: string, p: Partial<Line>) => {
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...p } : l)));
    setDirty(true);
  };
  const add = (p: ProductOption) => {
    setLines((ls) => [
      ...ls,
      {
        key: `n${Date.now()}`,
        productId: p.id,
        code: p.code,
        name: p.name,
        qty: 1,
        unit: "vnt.",
        priceCents: type === "PURCHASE_ORDER" || type === "PURCHASE_INVOICE" ? p.costCents : p.priceCents,
        discountPct: 0,
        vatPct: 21,
        supplierId: p.supplierId,
        costCents: p.costCents,
        image: p.image,
      },
    ]);
    setQ("");
    setHits([]);
    setDirty(true);
  };
  const addFree = (section = false) => {
    setLines((ls) => [...ls, { key: `f${Date.now()}`, productId: null, code: "", name: section ? "— Skyrius —" : "", qty: section ? 0 : 1, unit: "vnt.", priceCents: 0, discountPct: 0, vatPct: 21, supplierId: null, costCents: 0 }]);
    setDirty(true);
  };
  const move = (i: number, d: -1 | 1) => {
    setLines((ls) => {
      const j = i + d;
      if (j < 0 || j >= ls.length) return ls;
      const next = [...ls];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
    setDirty(true);
  };

  const totals = useMemo(() => docTotals(lines.map((l) => ({ qty: l.qty, priceCents: l.priceCents, discountPct: l.discountPct ?? 0, vatPct: l.vatPct ?? 21, costCents: l.costCents ?? 0 })), form.discountPct), [lines, form.discountPct]);

  const save = () =>
    startSave(async () => {
      const r = await saveErpDocument(props.id, type, { ...form, lines: lines.map(({ key, ...l }) => (void key, l)) });
      if (r.error) return setMsg({ error: r.error });
      setDirty(false);
      setMsg({ ok: "Išsaugota." });
      if (!props.id && r.id) router.push(`/admin/erp/${meta.path}/${r.id}`);
      else router.refresh();
    });

  return (
    <div className="space-y-4">
      <section className="rounded-xl bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4">
          <Lbl label="Data">
            <input type="date" className={inp} value={form.date} onChange={(e) => set("date", e.target.value)} />
          </Lbl>
          <Lbl label="Būsena">
            <select
              className={inp}
              value={form.status}
              onChange={(e) => {
                set("status", e.target.value);
                if (type === "OFFER") set("probability", statusDef("OFFER", e.target.value).probability ?? form.probability);
              }}
            >
              {STATUSES[type].map((s) => <option key={s.key} value={s.key}>{s.key}</option>)}
            </select>
          </Lbl>
          {isSale ? (
            <Lbl label="Klientas">
              <select className={inp} value={form.clientId} onChange={(e) => set("clientId", e.target.value)}>
                <option value="">— pasirinkite —</option>
                {props.clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Lbl>
          ) : (
            <Lbl label="Tiekėjas">
              <select className={inp} value={form.supplierId} onChange={(e) => set("supplierId", e.target.value)}>
                <option value="">— pasirinkite —</option>
                {props.suppliers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Lbl>
          )}
          <Lbl label="Vadybininkas">
            <select className={inp} value={form.managerId} onChange={(e) => set("managerId", e.target.value)}>
              <option value="">—</option>
              {props.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </Lbl>
          {isSale && (
            <>
              <Lbl label="Suinteresuota šalis (kanalas)">
                <select className={inp} value={form.channel} onChange={(e) => set("channel", e.target.value)}>
                  {CHANNELS.map((c) => <option key={c}>{c}</option>)}
                </select>
              </Lbl>
              <Lbl label="Architektas / partneris">
                <select className={inp} value={form.partyId} onChange={(e) => set("partyId", e.target.value)}>
                  <option value="">—</option>
                  {props.parties.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Lbl>
            </>
          )}
          {type === "OFFER" && (
            <>
              <Lbl label="Galioja iki">
                <input type="date" className={inp} value={form.validUntil} onChange={(e) => set("validUntil", e.target.value)} />
              </Lbl>
              <Lbl label="Tikimybė, %">
                <input type="number" min={0} max={100} className={inp} value={form.probability ?? 0} onChange={(e) => set("probability", Number(e.target.value))} />
              </Lbl>
            </>
          )}
          {type === "ORDER" && (
            <>
              <Lbl label="Avansas pagal sutartį, %">
                <input type="number" min={0} max={100} className={inp} value={form.advancePct} onChange={(e) => set("advancePct", Number(e.target.value))} />
              </Lbl>
              <Lbl label="Prekių pristatymo terminas">
                <select className={inp} value={form.deliveryTerm} onChange={(e) => set("deliveryTerm", e.target.value)}>
                  <option value="">—</option>
                  {DELIVERY_TERMS.map((d) => <option key={d}>{d}</option>)}
                </select>
              </Lbl>
            </>
          )}
          {type !== "OFFER" && type !== "ORDER" && (
            <Lbl label={type === "PURCHASE_ORDER" ? "Pristatymo data" : "Apmokėti iki"}>
              <input type="date" className={inp} value={form.dueDate} onChange={(e) => set("dueDate", e.target.value)} />
            </Lbl>
          )}
          <Lbl label="Nuolaida visam dokumentui, %">
            <input type="number" min={0} max={100} step={0.5} className={inp} value={form.discountPct} onChange={(e) => set("discountPct", Number(e.target.value))} />
          </Lbl>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <Lbl label="Komentaras / pastaba">
            <textarea rows={2} className={inp} value={form.note} onChange={(e) => set("note", e.target.value)} />
          </Lbl>
          {type === "ORDER" && (
            <Lbl label="Kintamas sutarties tekstas">
              <textarea rows={2} className={inp} value={form.contractText} onChange={(e) => set("contractText", e.target.value)} />
            </Lbl>
          )}
        </div>
      </section>

      <section className="rounded-xl bg-white p-4 shadow-sm">
        <div className="relative mb-3 max-w-xl">
          <input className={inp} placeholder="Pridėti produktą iš katalogo: pavadinimas, kodas, gamintojas…" value={q} onChange={(e) => setQ(e.target.value)} />
          {hits.length > 0 && (
            <div className="absolute z-30 mt-1 max-h-80 w-full overflow-auto rounded-md border border-zinc-200 bg-white shadow-lg">
              {hits.map((h) => (
                <button key={h.id} type="button" onClick={() => add(h)} className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-zinc-50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {h.image ? <img src={h.image} alt="" className="h-9 w-9 rounded object-contain" /> : <span className="h-9 w-9 rounded bg-zinc-100" />}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{h.name}</span>
                    <span className="block text-xs text-zinc-500">{[h.brand, h.code].filter(Boolean).join(" · ")}</span>
                  </span>
                  <span className="shrink-0 text-right text-xs tabular-nums">
                    {eur(h.priceCents)}
                    <span className="block text-zinc-400">sav. {eur(h.costCents)}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] text-sm">
            <thead className="text-left text-[11px] uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="w-8 pb-2" />
                <th className="min-w-[340px] pb-2 pr-2">Produktas</th>
                {showCost && <th className="w-40 pb-2 pr-2">Tiekėjas</th>}
                <th className="w-20 pb-2 pr-2">Kiekis</th>
                <th className="w-28 pb-2 pr-2 text-right">Kaina be PVM, €</th>
                <th className="w-20 pb-2 pr-2 text-right">Nuol., %</th>
                {meta.withCost && <th className="w-28 pb-2 pr-2 text-right">Savikaina, €</th>}
                <th className="w-28 pb-2 pr-2 text-right">Suma</th>
                {meta.withCost && <th className="w-24 pb-2 pr-2 text-right">Marža</th>}
                <th className="w-6 pb-2" />
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => {
                const net = lineNet({ qty: l.qty, priceCents: l.priceCents, discountPct: l.discountPct ?? 0, vatPct: 21 });
                const m = net - Math.round(l.qty * (l.costCents ?? 0));
                return (
                  <tr key={l.key} className="border-t border-zinc-100 align-top">
                    <td className="py-1.5 pr-1 text-center text-xs text-zinc-400">
                      <button type="button" onClick={() => move(i, -1)} className="block w-full hover:text-zinc-800" aria-label="Aukštyn">▲</button>
                      <button type="button" onClick={() => move(i, 1)} className="block w-full hover:text-zinc-800" aria-label="Žemyn">▼</button>
                    </td>
                    <td className="min-w-[340px] py-1.5 pr-2">
                      <div className="flex gap-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {l.image ? <img src={l.image} alt="" className="h-12 w-12 shrink-0 rounded bg-zinc-50 object-contain" /> : null}
                        <div className="grid min-w-0 flex-1 gap-1">
                          <input className={inp} value={l.name} placeholder="Pavadinimas (laisva eilutė)" onChange={(e) => patch(l.key, { name: e.target.value })} />
                          <div className="flex gap-1">
                            <input className={cn(inp, "w-32 text-xs")} value={l.code ?? ""} placeholder="Kodas" onChange={(e) => patch(l.key, { code: e.target.value })} />
                            <input className={cn(inp, "text-xs")} value={l.description ?? ""} placeholder="Aprašymas / apdaila" onChange={(e) => patch(l.key, { description: e.target.value })} />
                          </div>
                          {type === "PURCHASE_ORDER" && l.qty > 0 && <span className="text-[11px] text-zinc-500">Gauta: {(l as LineInput & { receivedQty?: number }).receivedQty ?? 0} iš {l.qty}</span>}
                        </div>
                      </div>
                    </td>
                    {showCost && (
                      <td className="py-1.5 pr-2">
                        <select className={cn(inp, "text-xs")} value={l.supplierId ?? ""} onChange={(e) => patch(l.key, { supplierId: e.target.value || null })}>
                          <option value="">—</option>
                          {props.suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                      </td>
                    )}
                    <td className="py-1.5 pr-2">
                      <input type="number" step="any" className={cn(inp, "text-right")} value={l.qty} onChange={(e) => patch(l.key, { qty: Number(e.target.value) })} />
                    </td>
                    <td className="py-1.5 pr-2"><MoneyInput cents={l.priceCents} onChange={(c) => patch(l.key, { priceCents: c })} /></td>
                    <td className="py-1.5 pr-2">
                      <input type="number" min={0} max={100} step={0.5} className={cn(inp, "text-right")} value={l.discountPct ?? 0} onChange={(e) => patch(l.key, { discountPct: Number(e.target.value) })} />
                    </td>
                    {meta.withCost && <td className="py-1.5 pr-2"><MoneyInput cents={l.costCents ?? 0} onChange={(c) => patch(l.key, { costCents: c })} /></td>}
                    <td className="py-2 pr-2 text-right tabular-nums">{eur(net)}</td>
                    {meta.withCost && <td className={cn("py-2 pr-2 text-right text-xs tabular-nums", l.priceCents > 0 && m / Math.max(1, net) < 0.2 ? "text-amber-700" : "text-zinc-600")}>{l.priceCents > 0 ? `${eur(m)}` : ""}</td>}
                    <td className="py-2 text-right">
                      <button type="button" onClick={() => { setLines((ls) => ls.filter((x) => x.key !== l.key)); setDirty(true); }} className="text-zinc-400 hover:text-red-600" aria-label="Pašalinti">×</button>
                    </td>
                  </tr>
                );
              })}
              {lines.length === 0 && <tr><td colSpan={10} className="py-6 text-center text-zinc-500">Eilučių dar nėra – pridėkite produktą iš katalogo arba laisvą eilutę.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => addFree(false)} className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm hover:bg-zinc-50">+ Laisva eilutė</button>
          <button type="button" onClick={() => addFree(true)} className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm hover:bg-zinc-50">+ Skyriaus eilutė</button>
        </div>
      </section>

      <section className="flex flex-wrap items-start justify-between gap-4 rounded-xl bg-white p-4 shadow-sm">
        <dl className="grid min-w-[280px] grid-cols-2 gap-x-6 gap-y-1 text-sm">
          <dt className="text-zinc-500">Suma be PVM</dt><dd className="text-right tabular-nums">{eur(totals.net)}</dd>
          <dt className="text-zinc-500">PVM 21%</dt><dd className="text-right tabular-nums">{eur(totals.vat)}</dd>
          <dt className="font-semibold">Iš viso</dt><dd className="text-right font-semibold tabular-nums">{eur(totals.total)}</dd>
          {meta.withCost && (
            <>
              <dt className="mt-2 text-zinc-500">Savikaina</dt><dd className="mt-2 text-right tabular-nums">{eur(totals.cost)}</dd>
              <dt className="text-zinc-500">Marža</dt><dd className={cn("text-right tabular-nums", totals.marginPct < 20 && "text-amber-700")}>{eur(totals.margin)} ({pct(totals.marginPct)})</dd>
            </>
          )}
          {type === "OFFER" && (
            <>
              <dt className="text-zinc-500">Svertinė vertė</dt><dd className="text-right tabular-nums">{eur(Math.round((totals.net * (form.probability ?? 0)) / 100))}</dd>
            </>
          )}
        </dl>
        <div className="flex flex-col items-end gap-2">
          <button type="button" onClick={save} disabled={saving || props.locked} className="rounded-md bg-zinc-900 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50">
            {saving ? "Saugoma…" : props.id ? "Išsaugoti" : `Sukurti: ${meta.label.toLowerCase()}`}
          </button>
          {dirty && <span className="text-xs text-zinc-500">Yra neišsaugotų pakeitimų</span>}
          {msg?.ok && !dirty && <span className="text-xs text-green-700">{msg.ok}</span>}
          {msg?.error && <span className="text-xs text-red-600">{msg.error}</span>}
        </div>
      </section>
    </div>
  );
}
