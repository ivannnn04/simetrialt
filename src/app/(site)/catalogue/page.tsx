import Link from "next/link";
import { db } from "@/lib/db";
import { formatPrice } from "@/lib/slug";

export const dynamic = "force-dynamic";

export const metadata = { title: "Katalogas — Simetria LT" };

export default async function CataloguePage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const [categories, products] = await Promise.all([
    db.category.findMany({
      orderBy: { sort: "asc" },
      where: { products: { some: { published: true } } },
    }),
    db.product.findMany({
      where: {
        published: true,
        ...(category ? { category: { slug: category } } : {}),
      },
      orderBy: { updatedAt: "desc" },
      include: { images: { orderBy: { sort: "asc" }, take: 1 } },
    }),
  ]);

  return (
    <div>
      <h1 className="mb-6 text-3xl font-semibold tracking-tight">Katalogas</h1>

      {categories.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2 text-sm">
          <Link
            href="/catalogue"
            className={`rounded-full px-3 py-1 ${!category ? "bg-zinc-900 text-white" : "bg-white shadow-sm hover:bg-zinc-100"}`}
          >
            Visi
          </Link>
          {categories.map((cat) => (
            <Link
              key={cat.id}
              href={`/catalogue?category=${cat.slug}`}
              className={`rounded-full px-3 py-1 ${category === cat.slug ? "bg-zinc-900 text-white" : "bg-white shadow-sm hover:bg-zinc-100"}`}
            >
              {cat.name}
            </Link>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {products.map((p) => (
          <Link
            key={p.id}
            href={`/catalogue/${p.slug}`}
            className="overflow-hidden rounded-xl bg-white shadow-sm hover:shadow"
          >
            {p.images[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.images[0].url} alt={p.images[0].alt} className="aspect-square w-full object-cover" />
            ) : (
              <div className="flex aspect-square items-center justify-center bg-zinc-100 text-zinc-400">
                Nėra nuotraukos
              </div>
            )}
            <div className="p-3">
              <p className="font-medium">{p.name}</p>
              <p className="text-sm text-zinc-500">{formatPrice(p.priceCents, p.currency)}</p>
            </div>
          </Link>
        ))}
      </div>
      {products.length === 0 && (
        <p className="text-zinc-500">Produktų kol kas nėra.</p>
      )}
    </div>
  );
}
