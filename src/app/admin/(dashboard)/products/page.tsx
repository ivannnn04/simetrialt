import Link from "next/link";
import { db } from "@/lib/db";
import { requireEditor } from "@/lib/auth";
import { saveCategory, deleteCategory, countExternalPhotos } from "@/actions/products";
import { ExternalPhotosButton } from "@/components/admin/ExternalPhotosButton";
import type { Prisma } from "@prisma/client";

const PER_PAGE = 100;
import { ProductsTable } from "@/components/admin/ProductsTable";
import { RegroupButton } from "@/components/admin/RegroupButton";

// bulk deletes and large lists can take a while on a busy database
export const maxDuration = 120;

export default async function ProductsList({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  await requireEditor();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const page = Math.max(1, Number(sp.page) || 1);
  const where: Prisma.ProductWhereInput = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { sku: { contains: q, mode: "insensitive" } },
          { brand: { contains: q, mode: "insensitive" } },
        ],
      }
    : {};
  const [products, total, allTotal, categories, external] = await Promise.all([
    db.product.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      include: { category: true, images: { orderBy: { sort: "asc" }, take: 1 } },
    }),
    db.product.count({ where }),
    db.product.count(),
    db.category.findMany({ orderBy: { sort: "asc" }, include: { _count: { select: { products: true } } } }),
    countExternalPhotos(),
  ]);
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const href = (n: number) => `/admin/products?${new URLSearchParams({ ...(q ? { q } : {}), ...(n > 1 ? { page: String(n) } : {}) })}`;
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Katalogas</h1>
        <div className="flex flex-wrap gap-2">
          <ExternalPhotosButton count={external} />
          <RegroupButton />
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

      <form className="flex flex-wrap items-center gap-2" action="/admin/products">
        <input
          name="q"
          defaultValue={q}
          placeholder="Ieškoti pagal pavadinimą, kodą ar prekės ženklą"
          className="w-full max-w-md rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
        <button className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm hover:bg-zinc-50">Ieškoti</button>
        {q && <Link href="/admin/products" className="text-sm text-zinc-500 hover:underline">Valyti</Link>}
        <span className="ml-auto text-sm text-zinc-500">
          {total} produktų · puslapis {page} iš {pages}
        </span>
      </form>

      <ProductsTable
        total={allTotal}
        products={products.map((p) => ({
          id: p.id,
          name: p.name,
          sku: p.sku,
          category: p.category?.name ?? null,
          priceCents: p.priceCents,
          currency: p.currency,
          published: p.published,
          inStock: p.inStock,
          image: p.images[0]?.url ?? null,
        }))}
      />

      {pages > 1 && (
        <nav className="flex flex-wrap items-center justify-center gap-2 text-sm">
          {page > 1 && <Link href={href(page - 1)} className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 hover:bg-zinc-50">← Ankstesnis</Link>}
          {Array.from({ length: pages }, (_, i) => i + 1)
            .filter((n) => n === 1 || n === pages || Math.abs(n - page) <= 2)
            .map((n, i, arr) => (
              <span key={n} className="flex items-center gap-2">
                {i > 0 && n - arr[i - 1] > 1 && <span className="text-zinc-400">…</span>}
                <Link
                  href={href(n)}
                  className={`rounded-md px-3 py-1.5 ${n === page ? "bg-zinc-900 text-white" : "border border-zinc-300 bg-white hover:bg-zinc-50"}`}
                >
                  {n}
                </Link>
              </span>
            ))}
          {page < pages && <Link href={href(page + 1)} className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 hover:bg-zinc-50">Kitas →</Link>}
        </nav>
      )}
    </div>
  );
}
