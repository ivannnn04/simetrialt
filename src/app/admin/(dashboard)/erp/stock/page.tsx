import Link from "next/link";
import { db } from "@/lib/db";
import { ensureWarehouses } from "@/lib/erp/docs";
import { eur, fmtDate } from "@/lib/erp/money";
import { erpStockMove } from "@/actions/erp";
import { Kpi, Td, Th } from "@/components/erp/ErpUi";
import { cn } from "@/lib/cn";

export const dynamic = "force-dynamic";

const MOVE_LABEL: Record<string, string> = { RECEIPT: "Pajamavimas", TRANSFER: "Perkėlimas", ISSUE: "Išdavimas klientui", WRITEOFF: "Nurašymas", RESERVE: "Rezervas" };

export default async function ErpStock({ searchParams }: { searchParams: Promise<{ wh?: string; q?: string; moved?: string; error?: string }> }) {
  const f = await searchParams;
  await ensureWarehouses();
  const warehouses = await db.erpWarehouse.findMany({ orderBy: { code: "asc" }, include: { stock: true } });
  const stock = await db.erpStock.findMany({
    where: { qty: { gt: 0 }, ...(f.wh ? { warehouseId: f.wh } : {}), ...(f.q ? { product: { OR: [{ name: { contains: f.q, mode: "insensitive" } }, { sku: { contains: f.q, mode: "insensitive" } }] } } : {}) },
    include: { product: { select: { id: true, name: true, sku: true, brand: true } }, warehouse: true },
    orderBy: [{ warehouse: { code: "asc" } }, { product: { name: "asc" } }],
    take: 500,
  });
  const moves = await db.erpStockMove.findMany({ orderBy: { createdAt: "desc" }, take: 30 });
  const productNames = Object.fromEntries((await db.product.findMany({ where: { id: { in: [...new Set(moves.map((m) => m.productId))] } }, select: { id: true, name: true } })).map((p) => [p.id, p.name]));
  const whName = Object.fromEntries(warehouses.map((w) => [w.id, `${w.code} ${w.name}`]));
  const units = warehouses.reduce((n, w) => n + w.stock.reduce((m, s) => m + s.qty, 0), 0);
  const value = warehouses.reduce((n, w) => n + w.stock.reduce((m, s) => m + Math.round(s.qty * s.costCents), 0), 0);
  const reserved = warehouses.reduce((n, w) => n + w.stock.reduce((m, s) => m + s.reserved, 0), 0);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Sandėlis</h1>
      {f.moved && <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">Judėjimas užregistruotas.</p>}
      {f.error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{f.error}</p>}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Vienetų sandėliuose" value={String(units)} />
        <Kpi label="Atsargų vertė (savikaina)" value={eur(value)} />
        <Kpi label="Rezervuota užsakymams" value={String(reserved)} />
        <Kpi label="Sandėliai" value={String(warehouses.length)} />
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Link href="/admin/erp/stock" className={cn("rounded-full border px-2.5 py-1 text-xs", !f.wh ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 bg-white")}>Visi sandėliai</Link>
        {warehouses.map((w) => (
          <Link key={w.id} href={`/admin/erp/stock?wh=${w.id}`} className={cn("rounded-full border px-2.5 py-1 text-xs", f.wh === w.id ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 bg-white")}>
            {w.code} — {w.name} <span className="opacity-60">{w.stock.reduce((m, s) => m + s.qty, 0)}</span>
          </Link>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-100 bg-zinc-50"><tr><Th>Produktas</Th><Th>Sandėlis</Th><Th right>Likutis</Th><Th right>Rezervuota</Th><Th right>Laisva</Th><Th right>Savikaina</Th><Th right>Vertė</Th></tr></thead>
            <tbody>
              {stock.map((s) => (
                <tr key={s.id} className="border-b border-zinc-50">
                  <Td><Link href={`/admin/products/${s.product.id}`} className="underline">{s.product.name}</Link><p className="text-xs text-zinc-500">{[s.product.brand, s.product.sku].filter(Boolean).join(" · ")}</p></Td>
                  <Td className="text-zinc-600">{s.warehouse.code} {s.warehouse.name}</Td>
                  <Td right>{s.qty}</Td>
                  <Td right className="text-amber-700">{s.reserved || ""}</Td>
                  <Td right>{Math.max(0, s.qty - s.reserved)}</Td>
                  <Td right>{eur(s.costCents)}</Td>
                  <Td right>{eur(Math.round(s.qty * s.costCents))}</Td>
                </tr>
              ))}
              {stock.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-zinc-500">Likučių nėra. Prekės pajamuojamos priimant pirkimo užsakymą.</td></tr>}
            </tbody>
          </table>
        </div>
        <aside className="space-y-4">
          <form action={erpStockMove} className="space-y-2 rounded-xl bg-white p-4 text-sm shadow-sm">
            <h2 className="font-semibold">Perkėlimas / išdavimas / nurašymas</h2>
            <select name="productId" required className="w-full rounded-md border border-zinc-300 px-2 py-1.5">
              <option value="">Produktas (iš likučių)…</option>
              {stock.map((s) => <option key={s.id} value={s.product.id}>{s.product.name} — {s.warehouse.code} ({s.qty})</option>)}
            </select>
            <select name="warehouseId" required className="w-full rounded-md border border-zinc-300 px-2 py-1.5">
              <option value="">Iš sandėlio…</option>
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.code} — {w.name}</option>)}
            </select>
            <select name="type" className="w-full rounded-md border border-zinc-300 px-2 py-1.5">
              <option value="TRANSFER">Perkelti į kitą sandėlį</option>
              <option value="ISSUE">Išduoti klientui</option>
              <option value="WRITEOFF">Nurašyti</option>
            </select>
            <select name="toWarehouseId" className="w-full rounded-md border border-zinc-300 px-2 py-1.5">
              <option value="">Į sandėlį (perkėlimui)…</option>
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.code} — {w.name}</option>)}
            </select>
            <input name="qty" type="number" step="any" min={0} defaultValue={1} className="w-full rounded-md border border-zinc-300 px-2 py-1.5" />
            <input name="note" placeholder="Pastaba (užsakymo nr., priežastis)" className="w-full rounded-md border border-zinc-300 px-2 py-1.5" />
            <button className="w-full rounded-md bg-zinc-900 px-3 py-2 font-medium text-white">Registruoti</button>
          </form>
          <section className="rounded-xl bg-white p-4 shadow-sm">
            <h2 className="mb-2 text-sm font-semibold">Paskutiniai judėjimai</h2>
            <ul className="space-y-1.5 text-xs">
              {moves.map((m) => (
                <li key={m.id}>
                  <span className="text-zinc-400">{fmtDate(m.createdAt)}</span> {MOVE_LABEL[m.type] ?? m.type}: <b>{m.qty}</b> × {productNames[m.productId] ?? "?"}
                  <span className="text-zinc-500"> · {whName[m.warehouseId]}{m.toWarehouseId ? ` → ${whName[m.toWarehouseId]}` : ""}{m.note ? ` · ${m.note}` : ""}</span>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
