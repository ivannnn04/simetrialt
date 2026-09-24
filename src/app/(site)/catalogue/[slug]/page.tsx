import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site/Header";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { ProductLine } from "@/components/home/HomeSections";
import { ProductInfo } from "@/components/product/ProductInfo";
import { ProductGallery } from "@/components/product/ProductGallery";
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
    <div className="flex w-full flex-col bg-cream pb-10 md:pb-[120px]">
      <SiteHeader variant="solid" />
      <section className="mx-auto grid w-full max-w-[1440px] gap-6 px-4 pt-[34px] md:px-10 min-[993px]:grid-cols-2 min-[993px]:gap-y-10 min-[993px]:gap-x-10 xl:gap-x-20">
        {/* Gallery column (node 4217:46872): vertical stack on desktop, slider up to 992px */}
        <div className="flex min-w-0 flex-col gap-[45px]">
          <Breadcrumbs items={crumbs} />
          <ProductGallery images={product.images} name={product.name} />
        </div>

        {/* Info column (node 4217:46881) */}
        <div className="min-[993px]:sticky min-[993px]:top-0 min-[993px]:self-start">
          <ProductInfo product={product} />
        </div>
      </section>

      <ProductLine products={product.related} title="Related Products" cta={null} className="pt-[120px]" />
    </div>
  );
}
