"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { saveQuote, searchProductsForQuote, type ProductHit, type QuoteInput, type QuoteItemInput } from "@/actions/quotes";
import { formatPrice } from "@/lib/slug";
import { cn } from "@/lib/cn";
import {
  groupQuoteLines,
  lineTotal,
  quoteTotals,
  QUOTE_NOTE_MAX,
  QUOTE_SECTION_NAME_MAX,
  QUOTE_SECTION_NOTE_MAX,
  QUOTE_SECTIONS_MAX,
  QUOTE_STATUS,
  UNSORTED_LABEL,
  VAT_PCT,
  type QuoteSection,
} from "@/lib/quotes";
import { Card, Field, Input, Notice, PrimaryButton, SecondaryButton, Select, inputCls } from "@/components/admin/ui";

type Line = QuoteItemInput & { key: string };

const euro = (cents: number) => formatPrice(cents);
const toEuro = (cents: number) => (cents / 100).toFixed(2);
const fromEuro = (s: string) => Math.round((Number.parseFloat(s.replace(",", ".")) || 0) * 100);
/** inputs in the lines table keep their own width (inputCls is full width) */
const cellCls = inputCls.replace("w-full ", "");
const newId = () => `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** 1 pozicija, 2 pozicijos, 10 pozicijų, 21 pozicija… */
function positions(n: number): string {
  const d = n % 10;
  const t = n % 100;
  if (d === 1 && t !== 11) return `${n} pozicija`;
  if (d >= 2 && d <= 9 && (t < 12 || t > 19)) return `${n} pozicijos`;
  return `${n} pozicijų`;
}

/**
 * Quote editor: the customer, the products (searched from the catalogue or added from a product page),
 * the quantity, unit price and discount per line, and a discount on the whole quote. Lines can be split
 * into sections – rooms or floors of the project – each with its own long note; lines without a section
 * stay under "Be skyriaus". Totals update as you type; "Išsaugoti" stores everything, "Spausdinti / PDF"
 * opens the printable offer.
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
  const [focusSection, setFocusSection] = useState<string | null>(null);
  const sections = form.sections;

  // where search hits and free lines go: the section last chosen (at first the section of the latest line), or "Be skyriaus"
  const [target, setTarget] = useState(() => {
    const last = quote.items[quote.items.length - 1]?.sectionId;
    return last && quote.sections.some((s) => s.id === last) ? last : "";
  });
  const targetId = target && sections.some((s) => s.id === target) ? target : "";

  useEffect(() => {
    // debounced catalogue search; a short query clears the list on the next tick
    const t = setTimeout(() => {
      if (q.trim().length < 2) setHits([]);
      else startSearch(async () => setHits(await searchProductsForQuote(q)));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  // leaving the page with unsaved changes asks first
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const totals = useMemo(() => quoteTotals(lines, form.discountPct), [lines, form.discountPct]);
  const groups = useMemo(() => groupQuoteLines(lines, sections), [lines, sections]);
  const set = <K extends keyof QuoteInput>(k: K, v: QuoteInput[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setDirty(true);
  };
  const patch = (key: string, p: Partial<Line>) => {
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...p } : l)));
    setDirty(true);
  };
  const add = (h: ProductHit) => {
    const sectionId = targetId || null;
    setLines((ls) => {
      const same = ls.find((l) => l.productId === h.id && (l.sectionId || null) === sectionId);
      if (same) return ls.map((l) => (l === same ? { ...l, quantity: l.quantity + 1 } : l));
      return [...ls, { key: `p${h.id}${Date.now()}`, productId: h.id, name: h.name, sku: h.sku, image: h.image, unitCents: h.unitCents, quantity: 1, discountPct: 0, sectionId }];
    });
    setQ("");
    setHits([]);
    setDirty(true);
  };
  const addCustom = () => {
    setLines((ls) => [...ls, { key: `c${Date.now()}`, productId: null, name: "", sku: "", image: "", unitCents: 0, quantity: 1, discountPct: 0, sectionId: targetId || null }]);
    setDirty(true);
  };
  /** moves a line to another section; it goes to the end of that section */
  const moveLine = (key: string, sectionId: string | null) => {
    setLines((ls) => {
      const line = ls.find((l) => l.key === key);
      return line ? [...ls.filter((l) => l.key !== key), { ...line, sectionId }] : ls;
    });
    setDirty(true);
  };

  const addSection = () => {
    if (sections.length >= QUOTE_SECTIONS_MAX) return;
    const id = newId();
    set("sections", [...sections, { id, name: `Skyrius ${sections.length + 1}`, note: "", sort: sections.length }]);
    setTarget(id);
    setFocusSection(id);
  };
  const patchSection = (id: string, p: Partial<QuoteSection>) => set("sections", sections.map((s) => (s.id === id ? { ...s, ...p } : s)));
  const moveSection = (id: string, dir: -1 | 1) => {
    const i = sections.findIndex((s) => s.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= sections.length) return;
    const list = [...sections];
    [list[i], list[j]] = [list[j], list[i]];
    set("sections", list.map((s, n) => ({ ...s, sort: n })));
  };
  const deleteSection = (s: QuoteSection) => {
    const count = lines.filter((l) => l.sectionId === s.id).length;
    const what = count ? ` Jo ${positions(count)} liks pasiūlyme, skiltyje „${UNSORTED_LABEL}“.` : "";
    if (!window.confirm(`Ištrinti skyrių „${s.name}“?${what}`)) return;
    set("sections", sections.filter((x) => x.id !== s.id).map((x, n) => ({ ...x, sort: n })));
    setLines((ls) => ls.map((l) => (l.sectionId === s.id ? { ...l, sectionId: null } : l)));
  };

  const save = () =>
    startSave(async () => {
      // lines go out in the order they are shown: section by section, "Be skyriaus" last
      const ordered = groupQuoteLines(lines, sections).flatMap((g) => g.lines.map(({ key, ...l }) => (void key, { ...l, sectionId: g.section?.id ?? null })));
      const r = await saveQuote(quote.id, { ...form, sections: sections.map((s, n) => ({ ...s, sort: n })), items: ordered });
      setMsg(r);
      if (r.ok) setDirty(false);
    });

  const lineRow = (l: Line) => (
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
            {sections.length > 0 && (
              <label className="mt-1.5 flex max-w-[280px] items-center gap-2 text-xs text-zinc-500">
                <span className="shrink-0">Skyrius</span>
                <select
                  value={l.sectionId && sections.some((s) => s.id === l.sectionId) ? l.sectionId : ""}
                  onChange={(e) => moveLine(l.key, e.target.value || null)}
                  aria-label={`Skyrius: ${l.name || "laisva pozicija"}`}
                  className="min-w-0 flex-1 rounded border border-zinc-200 bg-white px-1.5 py-1 text-xs text-zinc-800 focus:border-zinc-500 focus:outline-none"
                >
                  <option value="">{UNSORTED_LABEL}</option>
                  {sections.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </label>
            )}
          </div>
        </div>
      </td>
      <td className="py-2 pr-3">
        <input type="number" min={1} className={`${cellCls} w-16 xl:w-20`} value={l.quantity} onChange={(e) => patch(l.key, { quantity: Math.max(1, Number(e.target.value) || 1) })} />
      </td>
      <td className="py-2 pr-3">
        <input type="text" inputMode="decimal" className={`${cellCls} w-24 xl:w-28`} defaultValue={toEuro(l.unitCents)} onBlur={(e) => patch(l.key, { unitCents: fromEuro(e.target.value) })} />
      </td>
      <td className="py-2 pr-3">
        <input type="number" min={0} max={100} step={0.5} className={`${cellCls} w-20 xl:w-24`} value={l.discountPct} onChange={(e) => patch(l.key, { discountPct: Number(e.target.value) || 0 })} />
      </td>
      <td className="whitespace-nowrap py-2 pr-3 text-right tabular-nums">
        {euro(lineTotal(l))}
        {l.discountPct > 0 && <p className="text-xs text-zinc-400 line-through">{euro(l.unitCents * l.quantity)}</p>}
      </td>
      <td className="py-2 text-right">
        <button type="button" onClick={() => { setLines((ls) => ls.filter((x) => x.key !== l.key)); setDirty(true); }} className="text-zinc-400 hover:text-red-600" aria-label="Pašalinti">×</button>
      </td>
    </tr>
  );

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

      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-medium">Produktai</h2>
          <SecondaryButton type="button" onClick={addSection} disabled={sections.length >= QUOTE_SECTIONS_MAX} className="px-3 py-1.5">
            + Pridėti skyrių
          </SecondaryButton>
        </div>
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start">
          <div className="relative min-w-0 flex-1">
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
          {sections.length > 0 && (
            <label className="flex shrink-0 items-center gap-2 text-sm text-zinc-600 sm:w-[300px]">
              <span className="shrink-0">Pridėti į</span>
              <Select value={targetId} onChange={(e) => setTarget(e.target.value)} aria-label="Į kurį skyrių pridėti produktus">
                <option value="">{UNSORTED_LABEL}</option>
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </Select>
            </label>
          )}
        </div>
        {sections.length === 0 && (
          <p className="mb-3 text-xs text-zinc-500">
            Didesnį projektą galite suskirstyti į skyrius – patalpas ar aukštus (pvz., „Virtuvė“, „2 aukštas“), kiekvienam parašyti pastabą. Spauskite „+ Pridėti skyrių“.
          </p>
        )}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-sm">
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
            {groups.map((g) => (
              <tbody key={g.section?.id ?? "unsorted"}>
                {sections.length > 0 && (
                  <tr>
                    <td colSpan={6} className="pb-2 pt-5">
                      <SectionHeader
                        section={g.section}
                        index={g.section ? sections.findIndex((s) => s.id === g.section!.id) : -1}
                        total={sections.length}
                        count={g.lines.length}
                        subtotal={g.lines.reduce((n, l) => n + lineTotal(l), 0)}
                        isTarget={(g.section?.id ?? "") === targetId}
                        focus={!!g.section && focusSection === g.section.id}
                        onFocused={() => setFocusSection(null)}
                        onPatch={(p) => g.section && patchSection(g.section.id, p)}
                        onMove={(dir) => g.section && moveSection(g.section.id, dir)}
                        onDelete={() => g.section && deleteSection(g.section)}
                        onTarget={() => setTarget(g.section?.id ?? "")}
                      />
                    </td>
                  </tr>
                )}
                {g.lines.map(lineRow)}
                {g.section && g.lines.length === 0 && (
                  <tr>
                    <td colSpan={6} className="border-t border-zinc-100 py-4 text-center text-xs text-zinc-500">
                      Skyriuje dar nėra produktų. Pasirinkite jį laukelyje „Pridėti į“ ir ieškokite kataloge arba perkelkite eilutę pasirinkę skyrių.
                    </td>
                  </tr>
                )}
              </tbody>
            ))}
            {lines.length === 0 && sections.length === 0 && (
              <tbody>
                <tr>
                  <td colSpan={6} className="py-6 text-center text-sm text-zinc-500">Pridėkite produktus iš katalogo (paieška aukščiau) arba iš produkto puslapio svetainėje.</td>
                </tr>
              </tbody>
            )}
          </table>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <SecondaryButton type="button" onClick={addCustom}>
            + Laisva pozicija{targetId ? ` į „${sections.find((s) => s.id === targetId)?.name}“` : ""}
          </SecondaryButton>
          <SecondaryButton type="button" onClick={addSection} disabled={sections.length >= QUOTE_SECTIONS_MAX}>
            + Pridėti skyrių
          </SecondaryButton>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card title="Pastabos ir būsena">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
          <Field label="Bendra projekto pastaba" hint="Matoma klientui pasiūlyme (spausdinant / PDF) po sumos." className="mt-4">
            <GrowTextarea
              value={form.note}
              onChange={(v) => set("note", v)}
              maxLength={QUOTE_NOTE_MAX}
              minRows={3}
              ariaLabel="Bendra projekto pastaba"
              placeholder="Visas projektas: pristatymo terminas, montavimas, apmokėjimo sąlygos…"
            />
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

/** A textarea that grows with its text (long notes stay readable without an inner scrollbar). */
function GrowTextarea({
  value,
  onChange,
  maxLength,
  minRows = 2,
  ariaLabel,
  placeholder,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  maxLength: number;
  minRows?: number;
  ariaLabel: string;
  placeholder?: string;
  className?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      value={value}
      rows={minRows}
      maxLength={maxLength}
      aria-label={ariaLabel}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={cn(inputCls, "resize-none overflow-hidden leading-relaxed", className)}
    />
  );
}

/**
 * Header of one section (room / floor) in the quote: its name edited in place, line count and subtotal
 * after line discounts, order and delete controls, and the long note. "Be skyriaus" gets name, count and
 * subtotal only.
 */
function SectionHeader({
  section,
  index,
  total,
  count,
  subtotal,
  isTarget,
  focus,
  onFocused,
  onPatch,
  onMove,
  onDelete,
  onTarget,
}: {
  section: QuoteSection | null;
  index: number;
  total: number;
  count: number;
  subtotal: number;
  isTarget: boolean;
  focus: boolean;
  onFocused: () => void;
  onPatch: (p: Partial<QuoteSection>) => void;
  onMove: (dir: -1 | 1) => void;
  onDelete: () => void;
  onTarget: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!focus || !input.current) return;
    input.current.scrollIntoView({ block: "center", behavior: "smooth" });
    input.current.focus({ preventScroll: true });
    input.current.select();
    onFocused();
  }, [focus, onFocused]);

  const ctl = "flex h-8 w-8 items-center justify-center rounded-md text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900 disabled:pointer-events-none disabled:opacity-30";
  return (
    <div className={cn("rounded-lg border px-4 py-3", section ? "border-zinc-200 bg-zinc-50" : "border-dashed border-zinc-300 bg-white")}>
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
        <div className="min-w-0 flex-1">
          {section ? (
            <input
              ref={input}
              value={section.name}
              maxLength={QUOTE_SECTION_NAME_MAX}
              aria-label="Skyriaus pavadinimas"
              onChange={(e) => onPatch({ name: e.target.value })}
              onBlur={(e) => {
                if (!e.target.value.trim()) onPatch({ name: `Skyrius ${index + 1}` });
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
              className="-mx-2 w-full min-w-0 rounded-md border border-transparent bg-transparent px-2 py-1 text-lg font-semibold text-zinc-900 hover:border-zinc-300 focus:border-zinc-500 focus:bg-white focus:outline-none"
            />
          ) : (
            <p className="py-1 text-lg font-semibold text-zinc-700">{UNSORTED_LABEL}</p>
          )}
          <p className="text-xs normal-case tracking-normal text-zinc-500">
            {positions(count)}
            {count > 0 && (
              <>
                {"  ·  "}tarpinė suma <span className="font-semibold tabular-nums text-zinc-800">{formatPrice(subtotal)}</span>
              </>
            )}
            {isTarget ? (
              <span className="ml-2 rounded-full bg-zinc-900 px-2 py-0.5 text-[11px] text-white">nauji produktai čia</span>
            ) : (
              <button type="button" onClick={onTarget} className="ml-2 text-zinc-500 underline hover:text-zinc-900">
                pridėti čia
              </button>
            )}
          </p>
        </div>
        {section && (
          <div className="flex items-center gap-1">
            <button type="button" aria-label={`Perkelti „${section.name}“ aukštyn`} title="Aukštyn" disabled={index <= 0} onClick={() => onMove(-1)} className={ctl}>
              ↑
            </button>
            <button type="button" aria-label={`Perkelti „${section.name}“ žemyn`} title="Žemyn" disabled={index >= total - 1} onClick={() => onMove(1)} className={ctl}>
              ↓
            </button>
            <button type="button" onClick={onDelete} className="ml-2 rounded-md px-2 py-1 text-xs text-red-600 underline hover:bg-red-50">
              Ištrinti skyrių
            </button>
          </div>
        )}
      </div>
      {section && (
        <GrowTextarea
          value={section.note}
          onChange={(v) => onPatch({ note: v })}
          maxLength={QUOTE_SECTION_NOTE_MAX}
          ariaLabel={`Pastaba: ${section.name}`}
          placeholder="Pastaba apie šią patalpą / aukštą: matmenys, apdaila, pageidavimai, terminai… (matoma klientui pasiūlyme)"
          className="mt-2 font-normal normal-case tracking-normal"
        />
      )}
    </div>
  );
}
