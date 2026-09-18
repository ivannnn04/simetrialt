import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { formatPrice } from "@/lib/slug";
import { CmsContent } from "@/components/CmsContent";
import { SaveButton } from "@/components/catalogue/SaveButton";
import { PRODUCT_PLACEHOLDER_IMAGE } from "@/lib/placeholder";

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
            <div className="flex aspect-square items-center justify-center bg-[#f2f2f2]">
              {PRODUCT_PLACEHOLDER_IMAGE ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={PRODUCT_PLACEHOLDER_IMAGE} alt={product.name} className="max-h-[70%] max-w-[80%] object-contain" />
              ) : (
                <span className="text-zinc-400">No photo</span>
              )}
            </div>
          )}
          {product.images.map((img) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={img.id} src={img.url} alt={img.alt} className="w-full rounded-xl object-cover" />
          ))}
        </div>
        <div>
          <div className="mb-2 flex items-start justify-between gap-4">
            <h1 className="text-3xl font-semibold tracking-tight">{product.name}</h1>
            <SaveButton productId={product.id} />
          </div>
          {product.sku && <p className="mb-2 text-sm text-zinc-500">SKU: {product.sku}</p>}
          {product.salePriceCents != null && product.salePriceCents < product.priceCents ? (
            <p className="mb-6 flex items-baseline gap-3 text-2xl font-semibold">
              <span className="text-[#fb3b30]">{formatPrice(product.salePriceCents, product.currency)}</span>
              <span className="text-base font-light text-secondary line-through">{formatPrice(product.priceCents, product.currency)}</span>
            </p>
          ) : (
            <p className="mb-6 text-2xl font-semibold">{formatPrice(product.priceCents, product.currency)}</p>
          )}
          {(product.brand || product.typology || product.material) && (
            <dl className="mb-6 grid grid-cols-2 gap-y-2 border-y border-line py-4 text-sm">
              {product.brand && (<><dt className="text-secondary">Brand</dt><dd>{product.brand}</dd></>)}
              {product.typology && (<><dt className="text-secondary">Typology</dt><dd>{product.typology}</dd></>)}
              {product.material && (<><dt className="text-secondary">Material</dt><dd>{product.material}</dd></>)}
              <dt className="text-secondary">Availability</dt><dd>{product.inShowroom ? "In showroom" : "Online only"}</dd>
            </dl>
          )}
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
