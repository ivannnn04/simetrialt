"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { applyPriceChange, previewPriceChange, undoPriceChange, type PriceChangeInput, type PriceChangeLog, type Rounding } from "@/actions/prices";
import { Card, Field, Notice, PrimaryButton, Select, inputCls } from "@/components/admin/ui";

const eur = (cents: number) => new Intl.NumberFormat("lt-LT", { style: "currency", currency: "EUR" }).format(cents / 100);
const ROUNDING: Record<Rounding, string> = { cent: "iki cento", euro: "iki euro", ten: "iki 10 €" };

type Preview = Awaited<ReturnType<typeof previewPriceChange>>;

export function BrandPriceChange({ brands, log }: { brands: { name: string; count: number }[]; log: PriceChangeLog[] }) {
  const router = useRouter();
  const [input, setInput] = useState<PriceChangeInput>({ brand: "", percent: 0, rounding: "euro", includeSale: true, includeCost: true });
  const [percentText, setPercentText] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [result, setResult] = useState<{ ok?: string; error?: string } | null>(null);
  const [pending, start] = useTransition();

  const set = (patch: Partial<PriceChangeInput>) => {
    setInput((i) => ({ ...i, ...patch }));
    setPreview(null);
    setResult(null);
  };

  const showPreview = () => start(async () => setPreview(await previewPriceChange(input)));
  const doApply = () => {
    if (!confirm(`${input.brand}: pakeisti ${preview?.count ?? ""} produktų kainas ${input.percent > 0 ? "+" : ""}${input.percent} %?`)) return;
    start(async () => {
      const r = await applyPriceChange(input);
      setResult(r);
      if (r.ok) {
        setPreview(null);
        router.refresh();
      }
    });
  };
  const undo = (id: string) => {
    if (!confirm("Grąžinti buvusias kainas? Rankiniu būdu po šio pakeitimo pakeistos to prekės ženklo kainos taip pat bus grąžintos.")) return;
    start(async () => {
      setResult(await undoPriceChange(id));
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <Card title="Naujas pakeitimas">
        <div className="grid gap-4 md:grid-cols-[2fr_1fr_1fr]">
          <Field label="Prekės ženklas">
            <Select value={input.brand} onChange={(e) => set({ brand: e.target.value })}>
              <option value="">— pasirinkite —</option>
              {brands.map((b) => (
                <option key={b.name} value={b.name}>
                  {b.name} ({b.count})
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Pokytis, %" hint="Pvz. 5 (brangsta) arba -3 (pinga)">
            <input
              inputMode="decimal"
              value={percentText}
              onChange={(e) => {
                setPercentText(e.target.value);
                set({ percent: Number.parseFloat(e.target.value.replace(",", ".")) || 0 });
              }}
              placeholder="+5"
              className={inputCls}
            />
          </Field>
          <Field label="Apvalinti">
            <Select value={input.rounding} onChange={(e) => set({ rounding: e.target.value as Rounding })}>
              {Object.entries(ROUNDING).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="mt-4 flex flex-wrap gap-6 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={input.includeSale} onChange={(e) => set({ includeSale: e.target.checked })} />
            Keisti ir akcijos kainas
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={input.includeCost} onChange={(e) => set({ includeCost: e.target.checked })} />
            Keisti ir savikainą (ERP pirkimo kainą)
          </label>
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <button type="button" onClick={showPreview} disabled={pending || !input.brand || !input.percent} className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm hover:bg-zinc-50 disabled:opacity-50">
            Peržiūrėti
          </button>
          <PrimaryButton type="button" onClick={doApply} disabled={pending || !preview?.count}>
            {pending ? "Vykdoma…" : "Pritaikyti kainas"}
          </PrimaryButton>
        </div>
        {preview?.error && <div className="mt-4"><Notice tone="red">{preview.error}</Notice></div>}
        {preview?.count && preview.examples && (
          <div className="mt-5 space-y-3">
            <p className="text-sm">
              Bus pakeista <b>{preview.count}</b> produktų. Kainų suma: {eur(preview.totalBefore!)} → <b>{eur(preview.totalAfter!)}</b>
            </p>
            <table className="w-full text-sm">
              <thead className="text-left text-zinc-500">
                <tr>
                  <th className="py-2 font-medium">Produktas</th>
                  <th className="py-2 font-medium">Kodas</th>
                  <th className="py-2 text-right font-medium">Dabar</th>
                  <th className="py-2 text-right font-medium">Bus</th>
                </tr>
              </thead>
              <tbody>
                {preview.examples.map((x) => (
                  <tr key={x.sku + x.name} className="border-t border-zinc-100">
                    <td className="py-2 pr-4">{x.name}</td>
                    <td className="py-2 pr-4 text-zinc-500">{x.sku}</td>
                    <td className="py-2 text-right">
                      {eur(x.before)}
                      {x.saleBefore != null && <span className="block text-xs text-zinc-500">akcija {eur(x.saleBefore)}</span>}
                    </td>
                    <td className="py-2 text-right font-medium">
                      {eur(x.after)}
                      {x.saleAfter != null && <span className="block text-xs font-normal text-zinc-500">akcija {eur(x.saleAfter)}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.count > preview.examples.length && <p className="text-xs text-zinc-500">Rodomi pirmi {preview.examples.length} iš {preview.count}.</p>}
          </div>
        )}
        {result?.ok && <div className="mt-4"><Notice tone="green">{result.ok}</Notice></div>}
        {result?.error && <div className="mt-4"><Notice tone="red">{result.error}</Notice></div>}
      </Card>

      <Card title="Pakeitimų istorija">
        {log.length === 0 ? (
          <p className="text-sm text-zinc-500">Pakeitimų dar nebuvo.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-zinc-500">
              <tr>
                <th className="py-2 font-medium">Data</th>
                <th className="py-2 font-medium">Prekės ženklas</th>
                <th className="py-2 font-medium">Pokytis</th>
                <th className="py-2 font-medium">Produktų</th>
                <th className="py-2 font-medium">Atliko</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {log.map((l) => (
                <tr key={l.id} className="border-t border-zinc-100">
                  <td className="py-2">{new Date(l.at).toLocaleString("lt-LT")}</td>
                  <td className="py-2">{l.brand}</td>
                  <td className="py-2">
                    {l.percent > 0 ? "+" : ""}
                    {l.percent} % · {ROUNDING[l.rounding]}
                    {l.includeSale ? " · su akcijomis" : ""}
                    {l.includeCost ? " · su savikaina" : ""}
                  </td>
                  <td className="py-2">{l.count}</td>
                  <td className="py-2 text-zinc-500">{l.by}</td>
                  <td className="py-2 text-right">
                    {l.undoneAt ? (
                      <span className="text-xs text-zinc-500">atšaukta {new Date(l.undoneAt).toLocaleDateString("lt-LT")}</span>
                    ) : (
                      <button type="button" onClick={() => undo(l.id)} disabled={pending} className="text-xs text-red-600 underline disabled:opacity-50">
                        Atšaukti
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
