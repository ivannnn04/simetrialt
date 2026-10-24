import Link from "next/link";
import { db } from "@/lib/db";
import { saveCategory, deleteCategory } from "@/actions/products";
import { ProductsTable } from "@/components/admin/ProductsTable";

export default async function ProductsList() {
  const [products, categories] = await Promise.all([
    db.product.findMany({
      orderBy: { updatedAt: "desc" },
      include: { category: true, images: { orderBy: { sort: "asc" }, take: 2 } },
    }),
    db.category.findMany({ orderBy: { sort: "asc" }, include: { _count: { select: { products: true } } } }),
  ]);
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Katalogas</h1>
        <div className="flex gap-2">
          <Link href="/admin/products/import" className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm hover:bg-zinc-50">
            Importas iš katalogo (PDF + kainoraštis)
          </Link>
          <Link
            href="/admin/products/new"
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
          >
            + Naujas produktas
          </Link>
        </div>
      </div>

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

      <ProductsTable
        products={products.map((p) => ({
          id: p.id,
          name: p.name,
          sku: p.sku,
          category: p.category?.name ?? null,
          priceCents: p.priceCents,
          currency: p.currency,
          published: p.published,
          image: p.images[0]?.url ?? null,
        }))}
      />
    </div>
  );
}
