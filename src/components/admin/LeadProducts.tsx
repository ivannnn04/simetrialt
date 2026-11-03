"use client";

import { useState } from "react";
import type { LeadProduct, LeadSection } from "@/lib/lead-items";
import { cn } from "@/lib/cn";

/**
 * The products of an inquiry, like the client's album: a list with the technical specifications or a
 * grid of large photos; plus the same PDF the client can download.
 */
export function LeadProducts({
  items,
  title,
  customer,
  reference,
  sections = [],
  note = "",
}: {
  items: LeadProduct[];
  title: string;
  customer: { name: string; email: string };
  reference: string;
  /** the client's album sections (rooms, floors…) with their notes; empty for older inquiries */
  sections?: LeadSection[];
  /** the client's general notes about the project */
  note?: string;
}) {
  const [view, setView] = useState<"list" | "grid">("list");
  const [zoom, setZoom] = useState<{ item: number; image: number } | null>(null);
  const [exporting, setExporting] = useState(false);
  const units = items.reduce((n, i) => n + i.quantity, 0);
  const total = items.reduce((n, i) => n + i.unitCents * i.quantity, 0);
  // products by section, in the client's order; products outside any section (older inquiries) come first without a heading
  const indexed = items.map((item, n) => ({ item, n }));
  const groups: { section: LeadSection | null; list: typeof indexed }[] = [
    { section: null, list: indexed.filter(({ item }) => item.section == null || !sections[item.section]) },
    ...sections.map((section, k) => ({ section, list: indexed.filter(({ item }) => item.section === k) })),
  ].filter((g) => g.section || g.list.length);
  const eur = (cents: number) => `${(cents / 100).toLocaleString("lt-LT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

  const pdf = async () => {
    setExporting(true);
    try {
      const [{ downloadAlbumPdf }, { lt }] = await Promise.all([import("@/lib/album-pdf"), import("@/i18n/dictionaries/lt")]);
      await downloadAlbumPdf({
        collectionName: title,
        reference,
        customer,
        labels: lt.album.pdfDoc,
        note,
        groups: groups.map((g) => ({
          name: g.section?.name ?? "",
          note: g.section?.note ?? "",
          rows: g.list.map(({ item: i }) => ({
            name: `${i.name}${i.sku ? ` (${i.sku})` : ""}`,
            category: i.typology || i.category,
            brand: i.brand,
            quantity: i.quantity,
            unitCents: i.unitCents,
            note: i.note,
          })),
        })),
      });
    } finally {
      setExporting(false);
    }
  };

  const z = zoom ? items[zoom.item] : null;

  return (
    <div className="rounded-xl bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-zinc-500">Produktai užklausoje</h2>
          <p className="text-sm text-zinc-700">
            {items.length} produkt. · {units} vnt.{sections.some((s) => s.name !== "Be skyriaus") ? ` · ${sections.filter((s) => s.name !== "Be skyriaus").length} skyr.` : ""}
            {total ? ` · orientacinė suma ${eur(total)}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border border-zinc-300 p-0.5 text-sm">
            {(
              [
                ["list", "Sąrašas su specifikacijomis"],
                ["grid", "Nuotraukos"],
              ] as const
            ).map(([v, label]) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={cn("rounded px-3 py-1.5", view === v ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100")}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={pdf}
            disabled={exporting}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-50 disabled:opacity-50"
          >
            {exporting ? "Ruošiama…" : "PDF"}
          </button>
        </div>
      </div>

      {note && (
        <div className="mb-5 rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-amber-700">Bendros kliento pastabos apie projektą</p>
          <p className="whitespace-pre-wrap">{note}</p>
        </div>
      )}

      <div className="space-y-8">
        {groups.map(({ section, list }, g) => (
          <section key={g} className="space-y-3">
            {section && (
              <div className="space-y-2 border-t-2 border-zinc-900 pt-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-lg font-semibold text-zinc-900">{section.name}</h3>
                  <p className="text-sm text-zinc-500">
                    {list.length} produkt. · {list.reduce((u, { item }) => u + item.quantity, 0)} vnt.
                    {list.some(({ item }) => item.unitCents) ? ` · ${eur(list.reduce((u, { item }) => u + item.unitCents * item.quantity, 0))}` : ""}
                  </p>
                </div>
                {section.note && <p className="whitespace-pre-wrap rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">{section.note}</p>}
                {list.length === 0 && <p className="text-sm text-zinc-400">Šiame skyriuje produktų nėra.</p>}
              </div>
            )}
            {list.length > 0 &&
              (view === "list" ? (
                <div className="divide-y divide-zinc-200 border-y border-zinc-200">
                  {list.map(({ item: i, n }) => (
                    <div key={`${i.sku}-${n}`} className="grid gap-5 py-5 md:grid-cols-[140px_1fr_auto]">
                      <button
                        type="button"
                        onClick={() => i.images.length && setZoom({ item: n, image: 0 })}
                        className="aspect-square overflow-hidden rounded-md bg-[#f4f2ee]"
                      >
                        {i.images[0] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={i.images[0]} alt={i.name} className="h-full w-full object-cover" />
                        ) : (
                          <span className="flex h-full items-center justify-center text-xs text-zinc-400">Nuotraukos nėra</span>
                        )}
                      </button>
                      <div className="min-w-0 space-y-2">
                        <div>
                          {i.brand && <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{i.brand}</p>}
                          <p className="font-medium text-zinc-900">
                            {i.productId ? (
                              <a href={`/admin/products/${i.productId}`} className="hover:underline" title="Atidaryti produktą administravime">
                                {i.name}
                              </a>
                            ) : (
                              i.name
                            )}
                          </p>
                          <p className="text-xs text-zinc-500">
                            Kodas: {i.sku || "—"}
                            {i.typology ? ` · ${i.typology}` : ""}
                          </p>
                        </div>
                        {i.details.length > 0 && (
                          <dl className="grid grid-cols-[140px_1fr] gap-x-4 gap-y-1 text-sm">
                            {i.details.map((d) => (
                              <div key={d.title} className="contents">
                                <dt className="text-zinc-500">{d.title}</dt>
                                <dd className="text-zinc-800">{d.body}</dd>
                              </div>
                            ))}
                          </dl>
                        )}
                        {i.note && <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">Kliento pastaba: {i.note}</p>}
                        {!i.productId && <p className="text-xs text-red-600">Produkto kataloge nebėra (kodas pakeistas arba ištrintas).</p>}
                      </div>
                      <div className="text-right text-sm md:min-w-[150px]">
                        <p className="text-zinc-500">
                          {i.quantity} × {i.unit}
                        </p>
                        <p className="text-base font-semibold">{i.sum}</p>
                        {i.slug && (
                          <a href={`/catalogue/${i.slug}`} target="_blank" className="mt-2 inline-block text-xs text-zinc-500 underline">
                            Svetainėje ↗
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {list.map(({ item: i, n }) => (
                    <button
                      key={`${i.sku}-${n}`}
                      type="button"
                      onClick={() => i.images.length && setZoom({ item: n, image: 0 })}
                      className="overflow-hidden rounded-lg text-left ring-1 ring-zinc-200 hover:shadow-md"
                    >
                      <div className="aspect-[4/3] bg-[#f4f2ee]">
                        {i.images[0] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={i.images[0]} alt={i.name} className="h-full w-full object-cover" />
                        ) : (
                          <span className="flex h-full items-center justify-center text-sm text-zinc-400">Nuotraukos nėra</span>
                        )}
                      </div>
                      <div className="space-y-0.5 p-4">
                        {i.brand && <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{i.brand}</p>}
                        <p className="font-medium leading-snug">{i.name}</p>
                        <p className="text-sm text-zinc-500">
                          {i.quantity} × {i.unit}
                          {i.images.length > 1 ? ` · ${i.images.length} nuotr.` : ""}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              ))}
          </section>
        ))}
      </div>

      {z && zoom && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/85 p-6" onClick={() => setZoom(null)}>
          <div className="flex items-center justify-between text-white">
            <p className="text-sm">
              {z.name} · {zoom.image + 1} / {z.images.length}
            </p>
            <button type="button" className="rounded-full bg-white/10 px-4 py-2 text-sm hover:bg-white/20">
              Uždaryti ✕
            </button>
          </div>
          <div className="relative min-h-0 flex-1" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={z.images[zoom.image]} alt={z.name} className="absolute inset-0 m-auto max-h-full max-w-full object-contain" />
          </div>
          {z.images.length > 1 && (
            <div className="flex justify-center gap-2 pt-4" onClick={(e) => e.stopPropagation()}>
              {z.images.map((src, k) => (
                <button
                  key={src + k}
                  type="button"
                  onClick={() => setZoom({ item: zoom.item, image: k })}
                  className={cn("h-16 w-16 overflow-hidden rounded bg-white ring-2", k === zoom.image ? "ring-white" : "ring-transparent")}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className="h-full w-full object-contain" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
