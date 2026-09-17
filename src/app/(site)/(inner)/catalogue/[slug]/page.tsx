import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { formatPrice } from "@/lib/slug";
import { CmsContent } from "@/components/CmsContent";

export const dynamic = "force-dynamic";

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await db.product.findFirst({
    where: { slug, published: true },
    include: {
      images: { orderBy: { sort: "asc" } },
      category: true,
    },
  });
  if (!product) notFound();

  return (
    <div>
      <p className="mb-4 text-sm text-zinc-500">
        <Link href="/catalogue" className="hover:underline">Katalogas</Link>
        {product.category && <> / {product.category.name}</>}
      </p>
      <div className="grid gap-8 md:grid-cols-2">
        <div className="space-y-3">
          {product.images.length === 0 && (
            <div className="flex aspect-square items-center justify-center rounded-xl bg-zinc-100 text-zinc-400">
              Nėra nuotraukos
            </div>
          )}
          {product.images.map((img) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={img.id} src={img.url} alt={img.alt} className="w-full rounded-xl object-cover" />
          ))}
        </div>
        <div>
          <h1 className="mb-2 text-3xl font-semibold tracking-tight">{product.name}</h1>
          {product.sku && <p className="mb-2 text-sm text-zinc-500">SKU: {product.sku}</p>}
          <p className="mb-6 text-2xl font-semibold">
            {formatPrice(product.priceCents, product.currency)}
          </p>
          {product.description && <CmsContent content={product.description} />}
          <Link
            href={`/contact?product=${encodeURIComponent(product.name)}`}
            className="mt-8 inline-block rounded-md bg-zinc-900 px-6 py-3 text-sm font-medium text-white hover:bg-zinc-700"
          >
            Teirautis dėl šio produkto
          </Link>
        </div>
      </div>
    </div>
  );
}
