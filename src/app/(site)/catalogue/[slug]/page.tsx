import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site/Header";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { ProductLine } from "@/components/home/HomeSections";
import { ProductInfo } from "@/components/product/ProductInfo";
import { loadProduct } from "@/lib/product-page";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const product = await loadProduct(slug);
  return { title: product ? `${product.name} — Simetria LT` : "Product — Simetria LT" };
}

// Figma "Product page" (node 4217:46868)
export default async function ProductPage({ params }: Params) {
  const { slug } = await params;
  const product = await loadProduct(slug);
  if (!product) notFound();

  const crumbs = [
    { label: "Home", href: "/" },
    { label: "Products", href: "/catalogue" },
    ...(product.category
      ? [{ label: product.category.name, href: `/catalogue?category=${encodeURIComponent(product.category.slug)}` }]
      : []),
    ...(product.typology
      ? [
          {
            label: product.typology,
            href: product.category
              ? `/catalogue?category=${encodeURIComponent(product.category.slug)}&typology=${encodeURIComponent(product.typology)}`
              : undefined,
          },
        ]
      : []),
    { label: product.name },
  ];

  return (
    <div className="flex w-full flex-col bg-cream pb-[120px]">
      <SiteHeader variant="solid" />
      <section className="mx-auto grid w-full max-w-[1440px] gap-10 px-4 pt-[34px] md:px-10 lg:grid-cols-2 lg:gap-x-20">
        {/* Gallery column (node 4217:46872) */}
        <div className="flex flex-col gap-[45px]">
          <Breadcrumbs items={crumbs} />
          <div className="flex flex-col gap-4">
            {product.images.map((src, i) => (
              <figure key={i} className="flex aspect-[640/452] w-full items-center justify-center overflow-hidden bg-[#f2f2f2]">
                {src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={src}
                    alt={i === 0 ? product.name : ""}
                    className={i === 0 ? "max-h-[86%] max-w-[70%] object-contain" : "size-full object-cover"}
                  />
                ) : null}
              </figure>
            ))}
          </div>
        </div>

        {/* Info column (node 4217:46881) */}
        <div className="lg:sticky lg:top-0 lg:self-start">
          <ProductInfo product={product} />
        </div>
      </section>

      <ProductLine products={product.related} title="Related Products" cta={null} className="pt-[120px]" />
    </div>
  );
}
