"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { deleteProducts, setProductsInStock } from "@/actions/products";
import { Notice } from "@/components/admin/ui";
import { formatPrice } from "@/lib/slug";

export type ProductRow = {
  id: string;
  name: string;
  sku: string | null;
  category: string | null;
  priceCents: number;
  currency: string;
  published: boolean;
  inStock: boolean;
  image: string | null;
};

/** Products list with row selection, "delete selected" and "delete all". */
export function ProductsTable({ products }: { products: ProductRow[] }) {
  const [result, remove, removing] = useActionState(deleteProducts, null);
  const [picked, setSelected] = useState<Set<string>>(new Set());
  // ignore ids of rows that are gone (deleted meanwhile)
  const selected = new Set([...picked].filter((id) => products.some((p) => p.id === id)));
  const allChecked = products.length > 0 && selected.size === products.length;
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleAll = () => setSelected(allChecked ? new Set() : new Set(products.map((p) => p.id)));
  const router = useRouter();
  const [stockPending, startStock] = useTransition();
  // optimistic "in stock" switches until the list reloads
  const [stockOverride, setStockOverride] = useState<Record<string, boolean>>({});
  const inStock = (p: ProductRow) => stockOverride[p.id] ?? p.inStock;
  const setStock = (ids: string[], value: boolean) => {
    setStockOverride((o) => ({ ...o, ...Object.fromEntries(ids.map((id) => [id, value])) }));
    startStock(async () => {
      await setProductsInStock(ids, value);
      router.refresh();
    });
  };
  const confirmDelete = (message: string) => (e: React.FormEvent<HTMLFormElement>) => {
    if (!window.confirm(message)) e.preventDefault();
  };

  return (
    <div className="overflow-hidden rounded-xl bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 px-4 py-3">
        <p className="text-sm text-zinc-600">
          Produktų: <b>{products.length}</b>{selected.size > 0 && <> · pažymėta <b>{selected.size}</b></>}
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={selected.size === 0 || stockPending} onClick={() => setStock([...selected], true)} className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 disabled:opacity-40">
            Pažymėtus: yra sandėlyje
          </button>
          <button type="button" disabled={selected.size === 0 || stockPending} onClick={() => setStock([...selected], false)} className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 disabled:opacity-40">
            Pažymėtus: nėra sandėlyje
          </button>
          <form action={remove} onSubmit={confirmDelete(`Ištrinti pažymėtus produktus (${selected.size})? Veiksmo atšaukti negalima.`)}>
            {[...selected].map((id) => <input key={id} type="hidden" name="ids" value={id} />)}
            <button disabled={selected.size === 0 || removing} className="rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-40">
              Ištrinti pažymėtus
            </button>
          </form>
          <form action={remove} onSubmit={confirmDelete(`Ištrinti VISUS produktus (${products.length}) kartu su nuotraukomis? Veiksmo atšaukti negalima.`)}>
            <input type="hidden" name="all" value="on" />
            <button disabled={products.length === 0 || removing} className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-40">
              {removing ? "Trinama…" : "Ištrinti visus"}
            </button>
          </form>
        </div>
      </div>
      {result?.error && <div className="px-4 pt-3"><Notice tone="red">Nepavyko ištrinti: {result.error}</Notice></div>}
      {result && !result.error && <div className="px-4 pt-3"><Notice tone="green">Ištrinta produktų: {result.deleted}.</Notice></div>}
      <table className="w-full text-sm">
        <thead className="bg-zinc-50 text-left text-zinc-500">
          <tr>
            <th className="w-10 p-4"><input type="checkbox" checked={allChecked} onChange={toggleAll} aria-label="Pažymėti visus" /></th>
            <th className="p-4 font-medium">Produktas</th>
            <th className="p-4 font-medium">SKU</th>
            <th className="p-4 font-medium">Kategorija</th>
            <th className="p-4 font-medium">Kaina</th>
            <th className="p-4 font-medium">Sandėlyje</th>
            <th className="p-4 font-medium">Būsena</th>
          </tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <tr key={p.id} className={"border-t border-zinc-100 hover:bg-zinc-50" + (selected.has(p.id) ? " bg-zinc-50" : "")}>
              <td className="p-4"><input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} aria-label={p.name} /></td>
              <td className="p-4">
                <Link href={`/admin/products/${p.id}`} className="flex items-center gap-3 font-medium hover:underline">
                  {p.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.image} alt="" className="h-10 w-10 rounded object-cover" />
                  ) : (
                    <span className="flex h-10 w-10 items-center justify-center rounded bg-zinc-100 text-zinc-400">—</span>
                  )}
                  <span translate="no">{p.name}</span>
                </Link>
              </td>
              <td className="p-4 text-zinc-500">{p.sku ?? "—"}</td>
              <td className="p-4 text-zinc-500">{p.category ?? "—"}</td>
              <td className="p-4">{formatPrice(p.priceCents, p.currency)}</td>
              <td className="p-4">
                <button
                  type="button"
                  role="switch"
                  aria-checked={inStock(p)}
                  aria-label={`${p.name}: yra sandėlyje`}
                  onClick={() => setStock([p.id], !inStock(p))}
                  className={"relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition " + (inStock(p) ? "bg-green-600" : "bg-zinc-300")}
                >
                  <span className={"inline-block h-4 w-4 rounded-full bg-white shadow transition " + (inStock(p) ? "translate-x-[18px]" : "translate-x-0.5")} />
                </button>
              </td>
              <td className="p-4">
                {p.published ? (
                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">Paskelbtas</span>
                ) : (
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">Juodraštis</span>
                )}
              </td>
            </tr>
          ))}
          {products.length === 0 && (
            <tr>
              <td colSpan={7} className="p-6 text-center text-zinc-500">Produktų dar nėra.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
