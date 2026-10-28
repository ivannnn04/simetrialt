"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { saveQuote, searchProductsForQuote, type ProductHit, type QuoteInput, type QuoteItemInput } from "@/actions/quotes";
import { formatPrice } from "@/lib/slug";
import { lineTotal, quoteTotals, QUOTE_STATUS, VAT_PCT } from "@/lib/quotes";
import { Card, Field, Input, Notice, PrimaryButton, SecondaryButton, Select, Textarea, inputCls } from "@/components/admin/ui";

type Line = QuoteItemInput & { key: string };

const euro = (cents: number) => formatPrice(cents);
const toEuro = (cents: number) => (cents / 100).toFixed(2);
const fromEuro = (s: string) => Math.round((Number.parseFloat(s.replace(",", ".")) || 0) * 100);

/**
 * Quote editor: the customer, the products (searched from the catalogue or added from a product page),
 * the quantity, unit price and discount per line, and a discount on the whole quote. Totals update as
 * you type; "Išsaugoti" stores everything, "Spausdinti / PDF" opens the printable offer.
 */
export function QuoteEditor({ quote }: { quote: QuoteInput & { id: string; number: number } }) {
  const [form, setForm] = useState<QuoteInput>(quote);
  const [lines, setLines] = useState<Line[]>(quote.items.map((i, n) => ({ ...i, key: i.id ?? `n${n}` })));
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<ProductHit[]>([]);
  const [searching, startSearch] = useTransition();
  const [saving, startSave] = useTransition();
  const [msg, setMsg] = useState<{ ok?: string; error?: string } | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    // debounced catalogue search; a short query clears the list on the next tick
    const t = setTimeout(() => {
      if (q.trim().length < 2) setHits([]);
      else startSearch(async () => setHits(await searchProductsForQuote(q)));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const totals = useMemo(() => quoteTotals(lines, form.discountPct), [lines, form.discountPct]);
  const set = <K extends keyof QuoteInput>(k: K, v: QuoteInput[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setDirty(true);
  };
  const patch = (key: string, p: Partial<Line>) => {
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...p } : l)));
    setDirty(true);
  };
  const add = (h: ProductHit) => {
    setLines((ls) => {
      const same = ls.find((l) => l.productId === h.id);
      if (same) return ls.map((l) => (l === same ? { ...l, quantity: l.quantity + 1 } : l));
      return [...ls, { key: `p${h.id}${Date.now()}`, productId: h.id, name: h.name, sku: h.sku, image: h.image, unitCents: h.unitCents, quantity: 1, discountPct: 0 }];
    });
    setQ("");
    setHits([]);
    setDirty(true);
  };
  const addCustom = () => {
    setLines((ls) => [...ls, { key: `c${Date.now()}`, productId: null, name: "", sku: "", image: "", unitCents: 0, quantity: 1, discountPct: 0 }]);
    setDirty(true);
  };
  const save = () =>
    startSave(async () => {
      const r = await saveQuote(quote.id, { ...form, items: lines.map(({ key, ...l }) => (void key, l)) });
      setMsg(r);
      if (r.ok) setDirty(false);
    });

  return (
    <div className="space-y-6">
      <Card title="Klientas">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Field label="Vardas, pavardė">
            <Input value={form.customerName} onChange={(e) => set("customerName", e.target.value)} />
          </Field>
          <Field label="Įmonė">
            <Input value={form.company} onChange={(e) => set("company", e.target.value)} />
          </Field>
          <Field label="El. paštas">
            <Input type="email" value={form.customerEmail} onChange={(e) => set("customerEmail", e.target.value)} />
          </Field>
          <Field label="Telefonas">
            <Input value={form.customerPhone} onChange={(e) => set("customerPhone", e.target.value)} />
          </Field>
        </div>
      </Card>

      <Card title="Produktai">
        <div className="relative mb-4">
          <Input placeholder="Ieškoti kataloge: pavadinimas, kodas, prekės ženklas…" value={q} onChange={(e) => setQ(e.target.value)} />
          {(hits.length > 0 || searching) && q.trim().length >= 2 && (
            <div className="absolute z-20 mt-1 max-h-80 w-full overflow-auto rounded-md border border-zinc-200 bg-white shadow-lg">
              {searching && hits.length === 0 && <p className="p-3 text-sm text-zinc-500">Ieškoma…</p>}
              {hits.map((h) => (
                <button key={h.id} type="button" onClick={() => add(h)} className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-zinc-50">
                  {h.image ? <img src={h.image} alt="" className="h-10 w-10 rounded object-cover" /> : <span className="h-10 w-10 rounded bg-zinc-100" />}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{h.name}</span>
                    <span className="block text-xs text-zinc-500">{[h.brand, h.sku].filter(Boolean).join(" · ")}</span>
                  </span>
                  <span className="shrink-0 tabular-nums">{euro(h.unitCents)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="pb-2 pr-3 font-medium">Produktas</th>
              <th className="pb-2 pr-3 font-medium">Kiekis</th>
              <th className="pb-2 pr-3 font-medium">Vnt. kaina, €</th>
              <th className="pb-2 pr-3 font-medium">Nuolaida, %</th>
              <th className="pb-2 pr-3 text-right font-medium">Suma</th>
              <th className="pb-2" />
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.key} className="border-t border-zinc-100 align-top">
                <td className="py-2 pr-3">
                  <div className="flex items-start gap-3">
                    {l.image ? <img src={l.image} alt="" className="h-12 w-12 shrink-0 rounded object-cover" /> : <span className="h-12 w-12 shrink-0 rounded bg-zinc-100" />}
                    <div className="min-w-0 flex-1">
                      {l.productId ? (
                        <>
                          <p className="font-medium">{l.name}</p>
                          <p className="text-xs text-zinc-500">{l.sku}</p>
                        </>
                      ) : (
                        <div className="grid gap-1">
                          <input className={inputCls} placeholder="Pavadinimas (laisva pozicija)" value={l.name} onChange={(e) => patch(l.key, { name: e.target.value })} />
                          <input className={inputCls} placeholder="Kodas" value={l.sku} onChange={(e) => patch(l.key, { sku: e.target.value })} />
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="py-2 pr-3">
                  <input type="number" min={1} className={`${inputCls} w-20`} value={l.quantity} onChange={(e) => patch(l.key, { quantity: Math.max(1, Number(e.target.value) || 1) })} />
                </td>
                <td className="py-2 pr-3">
                  <input type="text" inputMode="decimal" className={`${inputCls} w-28`} defaultValue={toEuro(l.unitCents)} onBlur={(e) => patch(l.key, { unitCents: fromEuro(e.target.value) })} />
                </td>
                <td className="py-2 pr-3">
                  <input type="number" min={0} max={100} step={0.5} className={`${inputCls} w-24`} value={l.discountPct} onChange={(e) => patch(l.key, { discountPct: Number(e.target.value) || 0 })} />
                </td>
                <td className="py-2 pr-3 text-right tabular-nums">
                  {euro(lineTotal(l))}
                  {l.discountPct > 0 && <p className="text-xs text-zinc-400 line-through">{euro(l.unitCents * l.quantity)}</p>}
                </td>
                <td className="py-2 text-right">
                  <button type="button" onClick={() => { setLines((ls) => ls.filter((x) => x.key !== l.key)); setDirty(true); }} className="text-zinc-400 hover:text-red-600" aria-label="Pašalinti">×</button>
                </td>
              </tr>
            ))}
            {lines.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-sm text-zinc-500">Pridėkite produktus iš katalogo (paieška aukščiau) arba iš produkto puslapio svetainėje.</td>
              </tr>
            )}
          </tbody>
        </table>
        <div className="mt-3">
          <SecondaryButton type="button" onClick={addCustom}>+ Laisva pozicija</SecondaryButton>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card title="Pastabos ir būsena">
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Būsena">
              <Select value={form.status} onChange={(e) => set("status", e.target.value)}>
                {Object.entries(QUOTE_STATUS).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </Select>
            </Field>
            <Field label="Galioja iki">
              <Input type="date" value={form.validUntil} onChange={(e) => set("validUntil", e.target.value)} />
            </Field>
            <Field label="Nuolaida visam pasiūlymui, %">
              <Input type="number" min={0} max={100} step={0.5} value={form.discountPct} onChange={(e) => set("discountPct", Number(e.target.value) || 0)} />
            </Field>
          </div>
          <Field label="Pastaba klientui" className="mt-4">
            <Textarea rows={3} value={form.note} onChange={(e) => set("note", e.target.value)} placeholder="Pristatymo terminas, montavimas, apmokėjimo sąlygos…" />
          </Field>
        </Card>
        <Card title="Suma">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-zinc-500">Katalogo kaina</dt><dd className="tabular-nums">{euro(totals.list)}</dd></div>
            {totals.lineDiscount > 0 && <div className="flex justify-between"><dt className="text-zinc-500">Nuolaidos pozicijoms</dt><dd className="tabular-nums">− {euro(totals.lineDiscount)}</dd></div>}
            {totals.cartDiscount > 0 && <div className="flex justify-between"><dt className="text-zinc-500">Nuolaida pasiūlymui ({form.discountPct}%)</dt><dd className="tabular-nums">− {euro(totals.cartDiscount)}</dd></div>}
            <div className="flex justify-between border-t border-zinc-200 pt-2 text-base font-semibold"><dt>Iš viso</dt><dd className="tabular-nums">{euro(totals.total)}</dd></div>
            <div className="flex justify-between text-xs text-zinc-500"><dt>iš jų PVM {VAT_PCT}%</dt><dd className="tabular-nums">{euro(totals.vat)}</dd></div>
          </dl>
          <div className="mt-5 flex flex-wrap gap-2">
            <PrimaryButton type="button" onClick={save} disabled={saving}>{saving ? "Saugoma…" : "Išsaugoti"}</PrimaryButton>
            <Link href={`/admin/quotes/${quote.id}/print`} target="_blank" className={`rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm hover:bg-zinc-50 ${dirty ? "pointer-events-none opacity-50" : ""}`} aria-disabled={dirty}>
              Spausdinti / PDF
            </Link>
          </div>
          {dirty && <p className="mt-2 text-xs text-zinc-500">Yra neišsaugotų pakeitimų – prieš spausdinant išsaugokite.</p>}
          {msg?.error && <div className="mt-3"><Notice tone="red">{msg.error}</Notice></div>}
          {msg?.ok && !dirty && <div className="mt-3"><Notice tone="green">{msg.ok}</Notice></div>}
        </Card>
      </div>
    </div>
  );
}
