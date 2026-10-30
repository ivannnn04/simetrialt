"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { addProductToMyQuote } from "@/actions/quotes";
import { cn } from "@/lib/cn";

export type ShowroomVariant = {
  id: string;
  slug: string;
  sku: string;
  label: string;
  images: string[];
  price: string;
  oldPrice: string;
  description: string;
  details: { title: string; body: string }[];
};

export type ShowroomItem = {
  id: string;
  name: string;
  brand: string;
  category: string;
  typology: string;
  inShowroom: boolean;
  price: string;
  image: string | null;
  variants: ShowroomVariant[];
};

/** Big cards for showing the catalogue to a client on a screen or tablet; a card opens a full-screen view. */
export function ShowroomCatalogue({ items }: { items: ShowroomItem[] }) {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [brand, setBrand] = useState("");
  const [onlyShowroom, setOnlyShowroom] = useState(false);
  const [open, setOpen] = useState<number | null>(null);

  const categories = useMemo(() => [...new Set(items.map((i) => i.category).filter(Boolean))].sort(), [items]);
  const brands = useMemo(() => [...new Set(items.map((i) => i.brand).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [items]);
  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return items.filter(
      (i) =>
        (!category || i.category === category) &&
        (!brand || i.brand === brand) &&
        (!onlyShowroom || i.inShowroom) &&
        (!term || [i.name, i.brand, i.typology, ...i.variants.map((v) => `${v.sku} ${v.label}`)].join(" ").toLowerCase().includes(term))
    );
  }, [items, q, category, brand, onlyShowroom]);

  const fullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Katalogas klientams</h1>
          <p className="text-sm text-zinc-500">{list.length} produktų · paspauskite kortelę, kad atidarytumėte visu ekranu</p>
        </div>
        <button type="button" onClick={fullscreen} className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm hover:bg-zinc-50">
          ⛶ Pilnas ekranas
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ieškoti: pavadinimas, gamintojas, kodas…"
          className="h-12 w-full max-w-md rounded-md border border-zinc-300 bg-white px-4 text-base"
        />
        <select value={brand} onChange={(e) => setBrand(e.target.value)} className="h-12 rounded-md border border-zinc-300 bg-white px-3 text-base">
          <option value="">Visi gamintojai</option>
          {brands.map((b) => (
            <option key={b}>{b}</option>
          ))}
        </select>
        <label className="flex h-12 items-center gap-2 rounded-md border border-zinc-300 bg-white px-4 text-base">
          <input type="checkbox" checked={onlyShowroom} onChange={(e) => setOnlyShowroom(e.target.checked)} />
          Tik eksponuojami salone
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        {["", ...categories].map((c) => (
          <button
            key={c || "all"}
            type="button"
            onClick={() => setCategory(c)}
            className={cn("rounded-full border px-5 py-2 text-base", category === c ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 bg-white hover:bg-zinc-50")}
          >
            {c || "Visos kategorijos"}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <p className="rounded-lg bg-white p-10 text-center text-zinc-500">Nerasta produktų. Pakeiskite paiešką ar filtrus.</p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 2xl:grid-cols-3">
          {list.map((item, n) => (
            <button key={item.id} type="button" onClick={() => setOpen(n)} className="group overflow-hidden rounded-xl bg-white text-left shadow-sm ring-1 ring-zinc-200 transition hover:shadow-lg">
              <div className="relative aspect-[4/3] bg-[#f4f2ee]">
                {item.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.image} alt={item.name} loading="lazy" className="h-full w-full object-contain p-6 transition duration-300 group-hover:scale-[1.03]" />
                ) : (
                  <div className="flex h-full items-center justify-center text-zinc-400">Nuotraukos nėra</div>
                )}
                {item.inShowroom && <span className="absolute left-4 top-4 rounded-full bg-[#c30a1e] px-3 py-1 text-xs font-medium uppercase tracking-wide text-white">Salone</span>}
                {item.variants.length > 1 && <span className="absolute right-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs text-zinc-700">{item.variants.length} variantai</span>}
              </div>
              <div className="space-y-1 p-6">
                <p className="text-xs font-medium uppercase tracking-[0.15em] text-zinc-500">{item.brand || "—"}</p>
                <p className="text-2xl font-medium leading-tight tracking-tight">{item.name}</p>
                <div className="flex items-baseline justify-between gap-4 pt-1">
                  <p className="text-sm text-zinc-500">{item.typology || item.category}</p>
                  {item.price && <p className="text-xl font-medium">{item.price}</p>}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {open !== null && list[open] && <Presenter item={list[open]} onClose={() => setOpen(null)} onPrev={() => setOpen((open - 1 + list.length) % list.length)} onNext={() => setOpen((open + 1) % list.length)} position={`${open + 1} / ${list.length}`} />}
    </div>
  );
}

function Presenter({ item, onClose, onPrev, onNext, position }: { item: ShowroomItem; onClose: () => void; onPrev: () => void; onNext: () => void; position: string }) {
  const [vi, setVi] = useState(0);
  const [img, setImg] = useState(0);
  const [pending, start] = useTransition();
  const [added, setAdded] = useState<{ quoteId?: string; error?: string } | null>(null);
  const v = item.variants[vi] ?? item.variants[0];
  const images = v.images.length ? v.images : item.image ? [item.image] : [];

  const key = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") onPrev();
      if (e.key === "ArrowRight") onNext();
    },
    [onClose, onPrev, onNext]
  );
  useEffect(() => {
    window.addEventListener("keydown", key);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", key);
      document.body.style.overflow = "";
    };
  }, [key]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#f9f8f4] text-[#262626]">
      <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-3">
        <p className="text-sm text-zinc-500">{position}</p>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onPrev} className="h-11 w-11 rounded-full border border-zinc-300 text-xl hover:bg-white" aria-label="Ankstesnis">‹</button>
          <button type="button" onClick={onNext} className="h-11 w-11 rounded-full border border-zinc-300 text-xl hover:bg-white" aria-label="Kitas">›</button>
          <button type="button" onClick={onClose} className="ml-2 h-11 rounded-full bg-zinc-900 px-5 text-sm text-white">Uždaryti ✕</button>
        </div>
      </div>
      <div className="grid min-h-0 flex-1 lg:grid-cols-[1.4fr_1fr]">
        <div className="flex min-h-0 flex-col gap-3 p-6">
          <div className="relative min-h-0 flex-1 rounded-xl bg-[#f0ede6]">
            {images[img] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={images[img]} src={images[img]} alt={item.name} className="absolute inset-0 h-full w-full object-contain p-8" />
            ) : (
              <div className="flex h-full items-center justify-center text-zinc-400">Nuotraukos nėra</div>
            )}
          </div>
          {images.length > 1 && (
            <div className="flex gap-3 overflow-x-auto">
              {images.map((src, i) => (
                <button key={src + i} type="button" onClick={() => setImg(i)} className={cn("h-20 w-20 shrink-0 overflow-hidden rounded-md bg-[#f0ede6] ring-2", i === img ? "ring-zinc-900" : "ring-transparent")}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className="h-full w-full object-contain p-1" />
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="min-h-0 space-y-6 overflow-y-auto border-l border-zinc-200 p-8">
          <div className="space-y-2">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-[#c30a1e]">{item.brand}</p>
            <h2 className="text-4xl font-light leading-tight tracking-tight">{item.name}</h2>
            <p className="text-base text-zinc-500">{item.typology || item.category}</p>
          </div>
          {v.price && (
            <p className="text-3xl font-medium">
              {v.price}
              {v.oldPrice && <span className="ml-3 text-xl font-normal text-zinc-400 line-through">{v.oldPrice}</span>}
            </p>
          )}
          {item.variants.length > 1 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Variantai</p>
              <div className="flex flex-wrap gap-2">
                {item.variants.map((x, i) => (
                  <button
                    key={x.id}
                    type="button"
                    onClick={() => {
                      setVi(i);
                      setImg(0);
                      setAdded(null);
                    }}
                    className={cn("rounded-full border px-4 py-2 text-sm", i === vi ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 bg-white hover:bg-zinc-50")}
                  >
                    {x.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {v.description && <p className="whitespace-pre-line text-lg leading-relaxed text-zinc-700">{v.description}</p>}
          {v.details.length > 0 && (
            <dl className="divide-y divide-zinc-200 border-y border-zinc-200">
              {v.details.map((d) => (
                <div key={d.title} className="grid grid-cols-[160px_1fr] gap-4 py-3 text-base">
                  <dt className="text-zinc-500">{d.title}</dt>
                  <dd>{d.body}</dd>
                </div>
              ))}
            </dl>
          )}
          {v.sku && <p className="text-sm text-zinc-500">Kodas: {v.sku}</p>}
          <div className="flex flex-wrap items-center gap-3 pb-4">
            <button
              type="button"
              disabled={pending}
              onClick={() => start(async () => setAdded(await addProductToMyQuote(v.id)))}
              className="h-12 rounded-full bg-[#c30a1e] px-6 text-base font-medium text-white disabled:opacity-50"
            >
              {pending ? "Pridedama…" : "Į pasiūlymą"}
            </button>
            <a href={`/catalogue/${v.slug}`} target="_blank" className="h-12 rounded-full border border-zinc-300 px-6 text-base leading-[3rem] hover:bg-white">
              Svetainėje ↗
            </a>
            {added?.quoteId && (
              <a href={`/admin/quotes/${added.quoteId}`} className="text-sm underline">
                Pridėta – atidaryti pasiūlymą
              </a>
            )}
            {added?.error && <span className="text-sm text-red-600">{added.error}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
