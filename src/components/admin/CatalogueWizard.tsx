"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { upload } from "@vercel/blob/client";
import { analyzeCatalogue, findMoreImages, publishDraft } from "@/actions/catalogue-wizard";
import type { DraftImage, DraftItem, PublishResult, SubmitItem } from "@/lib/catalogue-wizard";
import { cn } from "@/lib/cn";
import { Card, Field, Input, Notice, PrimaryButton, SecondaryButton, Select, Textarea } from "@/components/admin/ui";
import { SITE_CATEGORIES, TYPOLOGIES, type SiteCategory } from "@/lib/taxonomy";

/**
 * Catalogue import wizard: upload the supplier PDF and price list, review each product as it will
 * appear on the website (editable), pick the photos, then submit to the catalogue.
 */
export function CatalogueWizard({ blobUploads }: { blobUploads: boolean }) {
  const [draft, analyze, analyzing] = useActionState(analyzeCatalogue, null);
  const [uploading, startUpload] = useTransition();
  const [progress, setProgress] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [webPhotos, setWebPhotos] = useState(true);
  const [files, setFiles] = useState<File[]>([]);

  /** With Blob storage the browser uploads the files itself (no 4.5 MB request limit), then the server reads them by URL. */
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.delete("documents");
    if (!blobUploads) {
      for (const f of files) fd.append("documents", f);
      startUpload(() => analyze(fd));
      return;
    }
    startUpload(async () => {
      setUploadError(null);
      try {
        const urls: string[] = [];
        for (const [n, file] of files.entries()) {
          setProgress(`Įkeliama ${n + 1} / ${files.length}: ${file.name}`);
          const blob = await upload(`imports/${file.name}`, file, {
            access: "public",
            handleUploadUrl: "/api/admin/upload",
            multipart: file.size > 20 * 1024 * 1024,
            onUploadProgress: (p) => setProgress(`Įkeliama ${n + 1} / ${files.length}: ${file.name} – ${p.percentage}%`),
          });
          urls.push(blob.url);
        }
        fd.set("urls", [String(fd.get("urls") ?? ""), ...urls].join("\n"));
        setProgress(files.length ? "Analizuojama…" : null);
        analyze(fd);
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : "Įkėlimas nepavyko.");
        setProgress(null);
      }
    });
  };
  const [result, setResult] = useState<PublishResult | null>(null);
  const [publishing, startPublish] = useTransition();
  const [saveProgress, setProgressText] = useState<string | null>(null);
  const [failedAt, setFailedAt] = useState<number | null>(null);
  const [finished, setFinished] = useState(false);
  const [items, setItems] = useState<DraftItem[]>([]);
  const [included, setIncluded] = useState<Set<number>>(new Set());
  const [publishNow, setPublishNow] = useState(true);
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
              : im.kind === "pool"
                ? { kind: "pool" as const, index: draft?.pool.findIndex((p) => p.src === im.src) ?? -1 }
                : { kind: "web" as const, src: im.src }
          )
          .filter((ref) => ref.kind === "web" || ref.index >= 0),
      };
    });

  const done = finished && result && !result.error;

  /** Saves the included items a few at a time, so no single request has to download hundreds of photos. */
  const publish = (startFrom = 0) =>
    startPublish(async () => {
      if (!draft) return;
      const all = toSubmit().filter((i) => i.include);
      const BATCH = 4;
      const acc: PublishResult = startFrom > 0 && result ? { ...result, error: undefined } : { created: 0, updated: 0, errors: [], products: [] };
      setFailedAt(null);
      setFinished(false);
      for (let i = startFrom; i < all.length; i += BATCH) {
        const chunk = all.slice(i, i + BATCH);
        setProgressText(`Įrašoma ${Math.min(i + BATCH, all.length)} / ${all.length}…`);
        const fd = new FormData();
        fd.set("token", draft.token);
        fd.set("items", JSON.stringify(chunk));
        fd.set("publish", publishNow ? "on" : "off");
        fd.set("final", i + BATCH >= all.length ? "on" : "off");
        let res: PublishResult | null = null;
        try {
          res = await publishDraft(null, fd);
        } catch (e) {
          res = { created: 0, updated: 0, errors: [], products: [], error: e instanceof Error ? e.message : "Ryšio klaida" };
        }
        if (!res || res.error) {
          setResult({ ...acc, error: res?.error ?? "Nepavyko įrašyti." });
          setFailedAt(i);
          setProgressText(null);
          return;
        }
        acc.created += res.created;
        acc.updated += res.updated;
        acc.errors.push(...res.errors);
        acc.products.push(...res.products);
        setResult({ ...acc });
      }
      setProgressText(null);
      setFinished(true);
    });

  return (
    <div className="space-y-6">
      <Card title="1. Tiekėjo dokumentai">
        <form action={analyze} onSubmit={onSubmit} className="space-y-4">
          <p className="text-sm text-zinc-600">
            Įkelkite viską, ką atsiuntė tiekėjas: PDF katalogus, kainoraščius (Excel / CSV), Word dokumentus, nuotraukas. Sistema
            pati atpažįsta, kas kuriame faile yra, sujungia produktus pagal SKU ir sudaro korteles su nuotraukomis, aprašymais,
            techniniais duomenimis ir kainomis. Jei kataloge nuotraukų nėra, jos surandamos internete.
            Tiekėjo kainoraštį PDF galima įkelti kartu su tiekėjų sąrašu (List.xlsx: prekės ženklas, svetainė, transporto %):
            kainos perskaičiuojamos pagal pasirinktą kainų tipą, o nuotraukos paimamos iš tiekėjo svetainės.
          </p>
          <div className="grid gap-4 md:grid-cols-[1fr_1fr_260px]">
            <Field label="Dokumentai" hint={blobUploads ? "Galima pažymėti kelis failus iš karto, iki 300 MB kiekvienas." : "Galima pažymėti kelis failus iš karto. Iki 4 MB vienam įkėlimui; didesniems naudokite nuorodas."}>
              <DropZone files={files} onFiles={setFiles} />
            </Field>
            <Field label="Nuorodos į failus" hint="Po vieną eilutėje: tiesioginės nuorodos į PDF, Excel ar nuotraukas">
              <Textarea name="urls" rows={2} placeholder={"https://…/catalogue.pdf\nhttps://…/pricelist.xlsx"} />
            </Field>
            <Field label="Prekės ženklas" hint="Jei dokumentuose jo nėra; naudojamas ir nuotraukų paieškai">
              <Input name="brand" placeholder="pvz. Marset" />
            </Field>
          </div>
          <Field label="Kainos kataloge" hint="Kaip iš katalogo kainos gaunama kaina svetainėje">
            <Select name="priceMode" defaultValue="retail" className="md:max-w-md">
              <option value="retail">Mažmeninė kaina (jau su PVM) – rodyti kaip kataloge</option>
              <option value="net">Tiekėjo kaina be PVM – pridėti transportą (List.xlsx) ir PVM</option>
              <option value="vat">Kaina be PVM – pridėti tik PVM</option>
            </Select>
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={webPhotos} onChange={(e) => setWebPhotos(e.target.checked)} />
            <input type="hidden" name="webPhotos" value={webPhotos ? "on" : "off"} />
            Produktams be nuotraukų automatiškai ieškoti nuotraukų internete (AI atrenka tinkamas)
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <PrimaryButton type="submit" disabled={analyzing || uploading}>{analyzing || uploading ? "Skaitoma… (gali užtrukti kelias minutes)" : "Analizuoti dokumentus"}</PrimaryButton>
            {(uploading || analyzing) && progress && <span className="text-sm text-zinc-500">{progress}</span>}
          </div>
        </form>
        {uploadError && <div className="mt-3"><Notice tone="red">{uploadError}</Notice></div>}
        {draft?.error && <div className="mt-3"><Notice tone="red">{draft.error}</Notice></div>}
      </Card>

      {draft && !draft.error && !done && (
        <>
          <Card title={`2. Peržiūra – ${draft.filename || "produktai"} (${items.length})`}>
            <div className="space-y-2 text-sm text-zinc-600">
              <p>
                Taip produktai atrodys svetainėje. Pataisykite tekstus, pažymėkite nuotraukas (pirma pažymėta – pagrindinė) ir nuimkite
                varnelę nuo tų, kurių įtraukti nereikia.
                {draft.aiUsed ? " Laukus sutvarkė AI." : " AI skaitymas išjungtas – laukai nuskaityti pagal taisykles. Kad AI skaitytų bet kokio stiliaus katalogus, Vercel → Settings → Environment Variables pridėkite ANTHROPIC_API_KEY."}
                {!draft.imageSearch && " Nuotraukų paieška internete išjungta (nėra SERPER_API_KEY)."}
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
              pool={draft.pool}
              onInclude={(v) => setIncluded((s) => { const n = new Set(s); if (v) n.add(item.idx); else n.delete(item.idx); return n; })}
              onChange={(patch) => update(item.idx, patch)}
            />
          ))}

          <Card title="3. Įrašyti į katalogą">
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={publishNow} onChange={(e) => setPublishNow(e.target.checked)} /> Iš karto rodyti svetainėje</label>
              <PrimaryButton type="button" onClick={() => publish(0)} disabled={publishing || included.size === 0}>
                {publishing ? saveProgress ?? "Įrašoma…" : `Patvirtinti ir įrašyti (${included.size})`}
              </PrimaryButton>
              <span className="text-xs text-zinc-500">Įrašoma po kelis produktus; esami (pagal SKU) atnaujinami, jų nuotraukos pakeičiamos pažymėtomis.</span>
            </div>
            {result?.error && (
              <div className="mt-3 space-y-2">
                <Notice tone="red">{result.error} Įrašyta iki šiol: nauji {result.created}, atnaujinti {result.updated}.</Notice>
                {failedAt !== null && <SecondaryButton type="button" onClick={() => publish(failedAt)} disabled={publishing}>Tęsti nuo {failedAt + 1}-o produkto</SecondaryButton>}
              </div>
            )}
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
  pool: { name: string; src: string }[];
  onInclude: (v: boolean) => void;
  onChange: (patch: Partial<DraftItem>) => void;
};

function ItemEditor({ item, token, included, canSearch, pool, onInclude, onChange }: EditorProps) {
  const [searching, startSearch] = useTransition();
  const [showPool, setShowPool] = useState(false);
  const addFromPool = (src: string) => {
    if (item.images.some((im) => im.src === src)) return;
    onChange({ images: [...item.images, { kind: "pool", src, selected: true }] });
    setShowPool(false);
  };
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
          {item.from.includes("pdf") && <span className="rounded-full bg-zinc-100 px-2 py-0.5">dokumentas{item.page ? `, psl. ${item.page}` : ""}</span>}
          {item.from.includes("ai") && <span className="rounded-full bg-violet-100 px-2 py-0.5 text-violet-800">išskyrė AI</span>}
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
              <p className="text-[13px] tracking-[-0.04em] text-zinc-500">{item.typology || item.category || "—"}</p>
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
            <Field label="Kategorija (svetainės skiltis)">
              <Select value={item.category} onChange={(e) => onChange({ category: e.target.value })}>
                {!SITE_CATEGORIES.includes(item.category as SiteCategory) && <option value={item.category}>{item.category || "—"}</option>}
                {SITE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            </Field>
            <Field label="Prekės ženklas"><Input value={item.brand} onChange={(e) => onChange({ brand: e.target.value })} /></Field>
            <Field label="Tipologija (meniu punktas)">
              <Input list={`typologies-${item.idx}`} value={item.typology} onChange={(e) => onChange({ typology: e.target.value })} />
              <datalist id={`typologies-${item.idx}`}>
                {(TYPOLOGIES[item.category as SiteCategory] ?? Object.values(TYPOLOGIES).flat()).map((t) => <option key={t} value={t} />)}
              </datalist>
            </Field>
            <Field label="Medžiaga"><Input value={item.material} onChange={(e) => onChange({ material: e.target.value })} /></Field>
            <Field label="Spalva"><Input value={item.colour} onChange={(e) => onChange({ colour: e.target.value })} /></Field>
            <Field label="Matmenys"><Input value={item.dimensions} onChange={(e) => onChange({ dimensions: e.target.value })} /></Field>
            <Field label="Svoris"><Input value={item.weight} onChange={(e) => onChange({ weight: e.target.value })} /></Field>
          </div>
          <Field label="Aprašymas"><Textarea rows={3} value={item.description} onChange={(e) => onChange({ description: e.target.value })} /></Field>

          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-zinc-800">Nuotraukos <span className="font-normal text-zinc-500">(spustelėkite, kad pažymėtumėte)</span></p>
              <div className="flex gap-2">
                {pool.length > 0 && (
                  <SecondaryButton type="button" onClick={() => setShowPool((v) => !v)}>Iš dokumentų ({pool.length})</SecondaryButton>
                )}
                <SecondaryButton type="button" onClick={search} disabled={searching || !canSearch} title={canSearch ? "" : "Reikia SERPER_API_KEY"}>
                  {searching ? "Ieškoma…" : "Rasti daugiau nuotraukų (AI)"}
                </SecondaryButton>
              </div>
            </div>
            {showPool && (
              <div className="mb-3 flex flex-wrap gap-2 rounded-md border border-dashed border-zinc-300 p-2">
                {pool.map((p) => (
                  <button key={p.src} type="button" onClick={() => addFromPool(p.src)} title={p.name} className="h-16 w-16 overflow-hidden rounded bg-zinc-50 hover:ring-2 hover:ring-zinc-900">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.src} alt="" className="h-full w-full object-contain" />
                  </button>
                ))}
              </div>
            )}
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
                  <span className="absolute bottom-0 left-0 right-0 bg-black/50 px-1 text-[10px] text-white">{im.kind === "web" ? im.source : "dokumentas"}</span>
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

/** File picker that looks like one: a dashed drop area with a button and the list of chosen files. */
function DropZone({ files, onFiles }: { files: File[]; onFiles: (f: File[]) => void }) {
  const [over, setOver] = useState(false);
  const add = (list: FileList | null) => {
    if (!list) return;
    const next = [...files];
    for (const f of Array.from(list)) if (!next.some((x) => x.name === f.name && x.size === f.size)) next.push(f);
    onFiles(next);
  };
  const fmt = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(n / 1024)} KB`);
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); add(e.dataTransfer.files); }}
      className={cn("rounded-lg border-2 border-dashed p-4 text-center transition-colors", over ? "border-zinc-900 bg-zinc-50" : "border-zinc-300")}
    >
      <label className="inline-block cursor-pointer rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700">
        Pasirinkti failus
        <input type="file" multiple accept=".pdf,.xlsx,.xls,.csv,.docx,.doc,.txt,.md,image/*,application/pdf" className="sr-only" onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
      </label>
      <p className="mt-2 text-xs text-zinc-500">arba nutempkite failus čia · PDF, Excel, CSV, Word, nuotraukos</p>
      {files.length > 0 && (
        <ul className="mt-3 space-y-1 text-left text-sm">
          {files.map((f) => (
            <li key={f.name + f.size} className="flex items-center justify-between gap-3 rounded bg-zinc-50 px-3 py-1.5">
              <span className="truncate">{f.name} <span className="text-xs text-zinc-400">{fmt(f.size)}</span></span>
              <button type="button" onClick={() => onFiles(files.filter((x) => x !== f))} className="text-zinc-400 hover:text-red-600" aria-label="Pašalinti">×</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
