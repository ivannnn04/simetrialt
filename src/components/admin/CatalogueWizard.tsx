"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { analyzeCatalogue, findMoreImages, publishDraft } from "@/actions/catalogue-wizard";
import type { DraftImage, DraftItem, PublishResult, SubmitItem } from "@/lib/catalogue-wizard";
import { cn } from "@/lib/cn";
import { Card, Field, Input, Notice, PrimaryButton, SecondaryButton, Textarea } from "@/components/admin/ui";

/**
 * Catalogue import wizard: upload the supplier PDF and price list, review each product as it will
 * appear on the website (editable), pick the photos, then submit to the catalogue.
 */
export function CatalogueWizard() {
  const [draft, analyze, analyzing] = useActionState(analyzeCatalogue, null);
  const [result, publish, publishing] = useActionState(publishDraft, null);
  const [items, setItems] = useState<DraftItem[]>([]);
  const [included, setIncluded] = useState<Set<number>>(new Set());
  const [publishNow, setPublishNow] = useState(true);
  const [source, setSource] = useState<"file" | "url">("file");
  // A new analysis replaces the editable copy (state adjusted during render, no effect needed).
  const [loadedToken, setLoadedToken] = useState("");
  if (draft && !draft.error && draft.token !== loadedToken) {
    setLoadedToken(draft.token);
    setItems(draft.items);
    setIncluded(new Set(draft.items.map((i) => i.idx)));
  }

  const update = (idx: number, patch: Partial<DraftItem>) => setItems((list) => list.map((i) => (i.idx === idx ? { ...i, ...patch } : i)));

  const toSubmit = (): SubmitItem[] =>
    items.map((i) => {
      const stored = draft?.items[i.idx];
      return {
        idx: i.idx,
        include: included.has(i.idx),
        sku: i.sku,
        name: i.name,
        description: i.description,
        category: i.category,
        brand: i.brand,
        typology: i.typology,
        material: i.material,
        colour: i.colour,
        dimensions: i.dimensions,
        weight: i.weight,
        price: i.price,
        salePrice: i.salePrice,
        images: i.images
          .filter((im) => im.selected)
          .map((im) =>
            im.kind === "catalogue"
              ? { kind: "catalogue" as const, index: stored?.images.findIndex((s) => s.src === im.src) ?? -1 }
              : { kind: "web" as const, src: im.src }
          )
          .filter((ref) => ref.kind === "web" || ref.index >= 0),
      };
    });

  const done = result && !result.error;

  return (
    <div className="space-y-6">
      <Card title="1. Tiekėjo katalogas ir kainoraštis">
        <form action={analyze} className="space-y-4">
          <p className="text-sm text-zinc-600">
            PDF katalogas duoda nuotraukas, aprašymus ir techninius duomenis, kainoraštis (Excel / CSV) – SKU ir kainas. Produktai
            sutapdinami pagal SKU. Galima įkelti ir tik vieną iš failų.
          </p>
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="PDF katalogas" hint={source === "file" ? "Iki 4 MB; didesniam naudokite nuorodą" : "Tiesioginė nuoroda į PDF failą"}>
              <div className="mb-2 flex gap-3 text-xs">
                <label className="flex items-center gap-1"><input type="radio" name="source" checked={source === "file"} onChange={() => setSource("file")} /> failas</label>
                <label className="flex items-center gap-1"><input type="radio" name="source" checked={source === "url"} onChange={() => setSource("url")} /> nuoroda</label>
              </div>
              {source === "file" ? (
                <input type="file" name="catalogue" accept="application/pdf,.pdf" className="text-sm" />
              ) : (
                <Input name="catalogueUrl" placeholder="https://…/catalogue.pdf" />
              )}
            </Field>
            <Field label="Kainoraštis (Excel / CSV)" hint="Stulpeliai atpažįstami automatiškai">
              <input type="file" name="pricelist" accept=".csv,.txt,.xlsx,.xls" className="text-sm" />
            </Field>
            <Field label="Prekės ženklas" hint="Naudojamas, jei failuose jo nėra, ir nuotraukų paieškai">
              <Input name="brand" placeholder="pvz. Marset" />
            </Field>
          </div>
          <PrimaryButton type="submit" disabled={analyzing}>{analyzing ? "Skaitoma… (gali užtrukti iki minutės)" : "Analizuoti"}</PrimaryButton>
        </form>
        {draft?.error && <div className="mt-3"><Notice tone="red">{draft.error}</Notice></div>}
      </Card>

      {draft && !draft.error && !done && (
        <>
          <Card title={`2. Peržiūra – ${draft.filename || "produktai"} (${items.length})`}>
            <div className="space-y-2 text-sm text-zinc-600">
              <p>
                Taip produktai atrodys svetainėje. Pataisykite tekstus, pažymėkite nuotraukas (pirma pažymėta – pagrindinė) ir nuimkite
                varnelę nuo tų, kurių įtraukti nereikia.
                {draft.aiUsed ? " Laukus sutvarkė AI." : " AI analizė išjungta (nėra ANTHROPIC_API_KEY) – laukai nuskaityti pagal taisykles."}
                {!draft.imageSearch && " Nuotraukų paieška internete išjungta (nėra GOOGLE_CSE_KEY / GOOGLE_CSE_CX)."}
              </p>
              {draft.warnings.map((w, i) => (
                <Notice key={i} tone="zinc">{w}</Notice>
              ))}
            </div>
          </Card>

          {items.map((item) => (
            <ItemEditor
              key={item.idx}
              item={item}
              token={draft.token}
              included={included.has(item.idx)}
              canSearch={draft.imageSearch}
              onInclude={(v) => setIncluded((s) => { const n = new Set(s); if (v) n.add(item.idx); else n.delete(item.idx); return n; })}
              onChange={(patch) => update(item.idx, patch)}
            />
          ))}

          <Card title="3. Įrašyti į katalogą">
            <form action={publish} className="flex flex-wrap items-center gap-4">
              <input type="hidden" name="token" value={draft.token} />
              <input type="hidden" name="items" value={JSON.stringify(toSubmit())} />
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="publish" checked={publishNow} onChange={(e) => setPublishNow(e.target.checked)} /> Iš karto rodyti svetainėje</label>
              <PrimaryButton type="submit" disabled={publishing || included.size === 0}>
                {publishing ? "Įrašoma…" : `Patvirtinti ir įrašyti (${included.size})`}
              </PrimaryButton>
              <span className="text-xs text-zinc-500">Esami produktai (pagal SKU) atnaujinami, jų nuotraukos pakeičiamos pažymėtomis.</span>
            </form>
            {result?.error && <div className="mt-3"><Notice tone="red">{result.error}</Notice></div>}
          </Card>
        </>
      )}

      {done && <Summary result={result} />}
    </div>
  );
}

function Summary({ result }: { result: PublishResult }) {
  return (
    <Card title="Įrašyta">
      <Notice tone="green">
        Nauji produktai: <b>{result.created}</b>, atnaujinti: <b>{result.updated}</b>.
      </Notice>
      {result.errors.length > 0 && <div className="mt-3"><Notice tone="red">{result.errors.slice(0, 10).join(" · ")}</Notice></div>}
      <ul className="mt-4 grid gap-1 text-sm md:grid-cols-2">
        {result.products.map((p) => (
          <li key={p.id} className="flex gap-3">
            <Link href={`/admin/products/${p.id}`} className="underline">{p.name}</Link>
            <Link href={`/catalogue/${p.slug}`} target="_blank" className="text-zinc-500 hover:underline">svetainėje ↗</Link>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex gap-3">
        <Link href="/admin/products" className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm hover:bg-zinc-50">Į produktų sąrašą</Link>
        <Link href="/admin/products/import" className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700">Importuoti dar</Link>
      </div>
    </Card>
  );
}

type EditorProps = {
  item: DraftItem;
  token: string;
  included: boolean;
  canSearch: boolean;
  onInclude: (v: boolean) => void;
  onChange: (patch: Partial<DraftItem>) => void;
};

function ItemEditor({ item, token, included, canSearch, onInclude, onChange }: EditorProps) {
  const [searching, startSearch] = useTransition();
  const [searchError, setSearchError] = useState<string | null>(null);
  const main = item.images.find((im) => im.selected) ?? item.images[0];
  const price = Number.parseFloat(item.price.replace(",", ".")) || 0;
  const sale = Number.parseFloat(item.salePrice.replace(",", ".")) || 0;
  const fmt = (n: number) => new Intl.NumberFormat("lt-LT", { style: "currency", currency: "EUR" }).format(n);

  const toggleImage = (n: number) => onChange({ images: item.images.map((im, i) => (i === n ? { ...im, selected: !im.selected } : im)) });

  const search = () =>
    startSearch(async () => {
      setSearchError(null);
      const res = await findMoreImages(token, item.idx, { brand: item.brand, name: item.name, description: item.description });
      if (res.error) setSearchError(res.error);
      const known = new Set(item.images.map((im) => im.src));
      const fresh: DraftImage[] = res.candidates
        .filter((c) => !known.has(c.src))
        .map((c) => ({ kind: "web", src: c.src, thumb: c.thumb, source: c.source, selected: c.match }));
      if (fresh.length) onChange({ images: [...item.images, ...fresh] });
      else if (!res.error) setSearchError("Naujų nuotraukų nerasta.");
    });

  return (
    <section className={cn("rounded-xl bg-white p-5 shadow-sm", !included && "opacity-60")}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked={included} onChange={(e) => onInclude(e.target.checked)} />
          #{item.idx + 1} · {item.name || item.sku}
        </label>
        <div className="flex flex-wrap gap-2 text-[11px]">
          {item.from.includes("pdf") && <span className="rounded-full bg-zinc-100 px-2 py-0.5">PDF{item.page ? ` psl. ${item.page}` : ""}</span>}
          {item.from.includes("pricelist") && <span className="rounded-full bg-zinc-100 px-2 py-0.5">kainoraštis</span>}
          {item.existing ? (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800">jau yra: {item.existing.name} → bus atnaujintas</span>
          ) : (
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-green-800">naujas</span>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        {/* website preview: the catalogue card plus the product-page summary */}
        <div className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Peržiūra svetainėje</p>
          <div className="relative flex aspect-[3/4] flex-col justify-between bg-[#f2f2f2] p-4">
            {main ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={main.thumb ?? main.src} alt="" className="pointer-events-none absolute inset-0 m-auto max-h-[62%] max-w-[85%] object-contain" />
            ) : (
              <span className="absolute inset-0 flex items-center justify-center text-xs text-zinc-400">be nuotraukos</span>
            )}
            <div className="relative flex flex-col gap-[5px] leading-none">
              <p className="text-[14px] tracking-[-0.04em] text-black">{item.name || "—"}</p>
              <p className="text-[13px] tracking-[-0.04em] text-zinc-500">{item.category || item.typology || "—"}</p>
            </div>
            <div className="relative flex items-center gap-1.5">
              {sale > 0 ? (
                <>
                  <span className="text-[13px] font-light text-zinc-500 line-through">{fmt(price)}</span>
                  <span className="text-[16px] text-[#fb3b30]">{fmt(sale)}</span>
                </>
              ) : (
                <span className="text-[16px] tracking-[-0.04em] text-black">{fmt(price)}</span>
              )}
            </div>
          </div>
          <div className="space-y-1 text-xs text-zinc-600">
            {item.brand && <p><span className="text-zinc-400">Prekės ženklas:</span> {item.brand}</p>}
            {item.sku && <p><span className="text-zinc-400">SKU:</span> {item.sku}</p>}
            {item.material && <p><span className="text-zinc-400">Medžiaga:</span> {item.material}</p>}
            {item.dimensions && <p><span className="text-zinc-400">Matmenys:</span> {item.dimensions}</p>}
            {item.description && <p className="whitespace-pre-line text-zinc-700">{item.description}</p>}
          </div>
        </div>

        {/* editable fields */}
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Pavadinimas" className="md:col-span-2"><Input value={item.name} onChange={(e) => onChange({ name: e.target.value })} /></Field>
            <Field label="SKU"><Input value={item.sku} onChange={(e) => onChange({ sku: e.target.value })} /></Field>
            <Field label="Kaina, EUR"><Input inputMode="decimal" value={item.price} onChange={(e) => onChange({ price: e.target.value })} /></Field>
            <Field label="Akcijos kaina, EUR"><Input inputMode="decimal" value={item.salePrice} onChange={(e) => onChange({ salePrice: e.target.value })} /></Field>
            <Field label="Kategorija"><Input value={item.category} onChange={(e) => onChange({ category: e.target.value })} /></Field>
            <Field label="Prekės ženklas"><Input value={item.brand} onChange={(e) => onChange({ brand: e.target.value })} /></Field>
            <Field label="Tipologija"><Input value={item.typology} onChange={(e) => onChange({ typology: e.target.value })} /></Field>
            <Field label="Medžiaga"><Input value={item.material} onChange={(e) => onChange({ material: e.target.value })} /></Field>
            <Field label="Spalva"><Input value={item.colour} onChange={(e) => onChange({ colour: e.target.value })} /></Field>
            <Field label="Matmenys"><Input value={item.dimensions} onChange={(e) => onChange({ dimensions: e.target.value })} /></Field>
            <Field label="Svoris"><Input value={item.weight} onChange={(e) => onChange({ weight: e.target.value })} /></Field>
          </div>
          <Field label="Aprašymas"><Textarea rows={3} value={item.description} onChange={(e) => onChange({ description: e.target.value })} /></Field>

          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-zinc-800">Nuotraukos <span className="font-normal text-zinc-500">(spustelėkite, kad pažymėtumėte)</span></p>
              <SecondaryButton type="button" onClick={search} disabled={searching || !canSearch} title={canSearch ? "" : "Reikia GOOGLE_CSE_KEY ir GOOGLE_CSE_CX"}>
                {searching ? "Ieškoma…" : "Rasti daugiau nuotraukų (AI)"}
              </SecondaryButton>
            </div>
            {searchError && <p className="mb-2 text-xs text-red-600">{searchError}</p>}
            <div className="flex flex-wrap gap-2">
              {item.images.map((im, n) => (
                <button
                  key={im.src}
                  type="button"
                  onClick={() => toggleImage(n)}
                  className={cn("relative h-24 w-24 overflow-hidden rounded-md border-2 bg-zinc-50", im.selected ? "border-zinc-900" : "border-transparent opacity-70 hover:opacity-100")}
                  title={im.source ?? "iš katalogo"}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={im.thumb ?? im.src} alt="" className="h-full w-full object-contain" />
                  <span className="absolute bottom-0 left-0 right-0 bg-black/50 px-1 text-[10px] text-white">{im.kind === "catalogue" ? "katalogas" : im.source}</span>
                  {im.selected && <span className="absolute right-1 top-1 rounded-full bg-zinc-900 px-1.5 text-[10px] text-white">✓</span>}
                </button>
              ))}
              {item.images.length === 0 && <p className="text-xs text-zinc-500">Kataloge nuotraukų nerasta.</p>}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
