import Link from "next/link";
import { db } from "@/lib/db";
import { formatPrice } from "@/lib/slug";
import { saveCategory, deleteCategory } from "@/actions/products";
import { CsvImportForm } from "@/components/CsvImportForm";

export default async function ProductsList() {
  const [products, categories] = await Promise.all([
    db.product.findMany({
      orderBy: { updatedAt: "desc" },
      include: { category: true, images: { orderBy: { sort: "asc" }, take: 1 } },
    }),
    db.category.findMany({ orderBy: { sort: "asc" }, include: { _count: { select: { products: true } } } }),
  ]);
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Katalogas</h1>
        <Link
          href="/admin/products/new"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
        >
          + Naujas produktas
        </Link>
      </div>

      <CsvImportForm />

      <div className="rounded-xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-lg font-medium">Kategorijos</h2>
        <div className="mb-4 flex flex-wrap gap-2">
          {categories.map((cat) => (
            <form key={cat.id} action={deleteCategory.bind(null, cat.id)}>
              <span className="inline-flex items-center gap-2 rounded-full bg-zinc-100 px-3 py-1 text-sm">
                {cat.name}
                <span className="text-xs text-zinc-500">({cat._count.products})</span>
                <button className="text-zinc-400 hover:text-red-600" title="Ištrinti">×</button>
              </span>
            </form>
          ))}
          {categories.length === 0 && <p className="text-sm text-zinc-500">Kategorijų dar nėra.</p>}
        </div>
        <form action={saveCategory} className="flex gap-2">
          <input
            name="name"
            placeholder="Nauja kategorija"
            required
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
          <button className="rounded-md border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-50">
            Pridėti
          </button>
        </form>
      </div>

      <div className="overflow-hidden rounded-xl bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-zinc-500">
            <tr>
              <th className="p-4 font-medium">Produktas</th>
              <th className="p-4 font-medium">SKU</th>
              <th className="p-4 font-medium">Kategorija</th>
              <th className="p-4 font-medium">Kaina</th>
              <th className="p-4 font-medium">Būsena</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className="border-t border-zinc-100 hover:bg-zinc-50">
                <td className="p-4">
                  <Link href={`/admin/products/${p.id}`} className="flex items-center gap-3 font-medium hover:underline">
                    {p.images[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.images[0].url} alt="" className="h-10 w-10 rounded object-cover" />
                    ) : (
                      <span className="flex h-10 w-10 items-center justify-center rounded bg-zinc-100 text-zinc-400">—</span>
                    )}
                    {p.name}
                  </Link>
                </td>
                <td className="p-4 text-zinc-500">{p.sku ?? "—"}</td>
                <td className="p-4 text-zinc-500">{p.category?.name ?? "—"}</td>
                <td className="p-4">{formatPrice(p.priceCents, p.currency)}</td>
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
                <td colSpan={5} className="p-6 text-center text-zinc-500">Produktų dar nėra.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
