"use client";

import { useActionState, useState } from "react";
import { analyzeImport, runImport } from "@/actions/catalogue-import";
import { FIELDS, FIELD_LABELS } from "@/lib/catalogue-import";
import { Card, Field, Input, Notice, PrimaryButton, SecondaryButton, inputCls } from "@/components/admin/ui";

/**
 * Two-step price-list import: upload a CSV / Excel file, check the guessed column mapping on a
 * preview, run a dry run, then import. Existing products are matched by SKU.
 */
export function CatalogueImport() {
  const [analysis, analyze, analyzing] = useActionState(analyzeImport, null);
  const [result, run, running] = useActionState(runImport, null);
  const [showPlan, setShowPlan] = useState(false);
  // Options are controlled so they survive the form reset after a dry run.
  const [opts, setOpts] = useState({ defaultBrand: "", defaultCategory: "", multiplier: "1", dryRun: true, publish: false, onlyUpdate: false, keepExisting: false });
  const set = (k: keyof typeof opts, v: string | boolean) => setOpts((o) => ({ ...o, [k]: v }));

  return (
    <div className="space-y-6">
      <Card title="1. Įkelti kainoraštį (CSV arba Excel)">
        <form action={analyze} className="space-y-3">
          <p className="text-sm text-zinc-600">
            Tinka tiekėjo kainoraštis tokiu pavidalu, koks yra: stulpeliai atpažįstami automatiškai (kodas, pavadinimas, kaina…), o
            prieš įrašant galėsite juos patikslinti. Produktai atnaujinami pagal SKU, nauji – sukuriami.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <input type="file" name="file" accept=".csv,.txt,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required className="text-sm" />
            <PrimaryButton type="submit" disabled={analyzing}>{analyzing ? "Analizuojama…" : "Analizuoti failą"}</PrimaryButton>
          </div>
        </form>
        {analysis?.error && <Notice tone="red">{analysis.error}</Notice>}
      </Card>

      {analysis && !analysis.error && (
        <Card title={`2. Stulpelių atitikimas – ${analysis.filename}${analysis.sheet ? ` (${analysis.sheet})` : ""}`}>
          <form action={run} className="space-y-5">
            <input type="hidden" name="token" value={analysis.token} />
            <p className="text-sm text-zinc-600">
              Eilučių: <b>{analysis.totalRows}</b>. Pagal SKU jau yra kataloge: <b>{analysis.existingBySku}</b> (bus atnaujinti).
              {analysis.withoutSku > 0 && <> Be SKU: <b>{analysis.withoutSku}</b> (bus sutapdinti pagal pavadinimą).</>}
            </p>
            <div className="overflow-x-auto rounded-lg border border-zinc-200">
              <table className="w-full text-xs">
                <thead className="bg-zinc-50">
                  <tr>
                    {analysis.headers.map((h, i) => (
                      <th key={i} className="min-w-[150px] p-2 text-left align-top font-normal">
                        <p className="mb-1 truncate font-medium text-zinc-800" title={h}>{h || `(stulpelis ${i + 1})`}</p>
                        <select name={`col:${i}`} defaultValue={analysis.guess[i]} className={inputCls + " py-1"}>
                          <option value="">— nenaudoti —</option>
                          {FIELDS.map((f) => (
                            <option key={f} value={f}>{FIELD_LABELS[f]}</option>
                          ))}
                        </select>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {analysis.sample.map((r, ri) => (
                    <tr key={ri} className="border-t border-zinc-100">
                      {analysis.headers.map((_, ci) => (
                        <td key={ci} className="max-w-[220px] truncate p-2 text-zinc-600" title={r[ci]}>{r[ci]}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Prekės ženklas visoms eilutėms" hint="Jei faile nėra stulpelio">
                <Input name="defaultBrand" placeholder="pvz. Marset" value={opts.defaultBrand} onChange={(e) => set("defaultBrand", e.target.value)} />
              </Field>
              <Field label="Kategorija visoms eilutėms" hint="Jei faile nėra stulpelio">
                <Input name="defaultCategory" placeholder="pvz. Lighting" value={opts.defaultCategory} onChange={(e) => set("defaultCategory", e.target.value)} />
              </Field>
              <Field label="Kainos koeficientas" hint="Tiekėjo kaina × koeficientas; 1 = be pakeitimų">
                <Input name="multiplier" inputMode="decimal" value={opts.multiplier} onChange={(e) => set("multiplier", e.target.value)} />
              </Field>
            </div>
            <div className="flex flex-wrap gap-6 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" name="dryRun" checked={opts.dryRun} onChange={(e) => set("dryRun", e.target.checked)} /> Tik peržiūra (nieko neįrašyti)</label>
              <label className="flex items-center gap-2"><input type="checkbox" name="publish" checked={opts.publish} onChange={(e) => set("publish", e.target.checked)} /> Naujus produktus iš karto paskelbti</label>
              <label className="flex items-center gap-2"><input type="checkbox" name="onlyUpdate" checked={opts.onlyUpdate} onChange={(e) => set("onlyUpdate", e.target.checked)} /> Tik atnaujinti esamus (nekurti naujų)</label>
              <label className="flex items-center gap-2"><input type="checkbox" name="updateExisting" value="off" checked={opts.keepExisting} onChange={(e) => set("keepExisting", e.target.checked)} /> Esamų neliesti (tik nauji)</label>
            </div>
            <div className="flex gap-3">
              <PrimaryButton type="submit" disabled={running}>{running ? "Vykdoma…" : "Vykdyti"}</PrimaryButton>
              <SecondaryButton type="button" onClick={() => setShowPlan((v) => !v)} disabled={!result?.plan?.length}>
                {showPlan ? "Slėpti sąrašą" : "Rodyti eilučių sąrašą"}
              </SecondaryButton>
            </div>
          </form>

          {result?.error && <div className="mt-4"><Notice tone="red">{result.error}</Notice></div>}
          {result && !result.error && (
            <div className="mt-4 space-y-3">
              <Notice tone={result.dryRun ? "zinc" : "green"}>
                {result.dryRun ? "Peržiūra (niekas neįrašyta): " : "Importuota: "}
                nauji <b>{result.created}</b>, atnaujinti <b>{result.updated}</b>, praleisti <b>{result.skipped}</b>.
                {result.dryRun && " Nuimkite „Tik peržiūra“ ir spauskite „Vykdyti“, kad įrašytumėte."}
              </Notice>
              {result.errors.length > 0 && <Notice tone="red">{result.errors.slice(0, 8).join(" · ")}</Notice>}
              {showPlan && result.plan && (
                <div className="max-h-80 overflow-auto rounded-lg border border-zinc-200">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-zinc-50 text-left"><tr><th className="p-2">Veiksmas</th><th className="p-2">SKU</th><th className="p-2">Pavadinimas</th><th className="p-2">Kaina</th></tr></thead>
                    <tbody>
                      {result.plan.map((p, i) => (
                        <tr key={i} className="border-t border-zinc-100">
                          <td className="p-2">{p.action === "create" ? "naujas" : p.action === "update" ? "atnaujinti" : "praleisti"}</td>
                          <td className="p-2 text-zinc-500">{p.sku}</td>
                          <td className="p-2">{p.name}</td>
                          <td className="p-2 text-zinc-500">{p.price}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
