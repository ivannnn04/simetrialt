import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site/Header";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { ProductLine } from "@/components/home/HomeSections";
import { ProductDetails } from "@/components/product/ProductDetails";
import { DESCRIPTION, loadProduct } from "@/lib/product-page";
import { getT } from "@/i18n/server";
import { term } from "@/i18n/dictionaries";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const [{ slug }, t] = await Promise.all([params, getT()]);
  const product = await loadProduct(slug);
  return { title: product ? t.product.meta(product.name) : t.product.fallback };
}

// Figma "Product page" (node 4217:46868)
export default async function ProductPage({ params }: Params) {
  const [{ slug }, t] = await Promise.all([params, getT()]);
  const loaded = await loadProduct(slug);
  if (!loaded) notFound();
  // The placeholder description follows the locale until products carry their own translations.
  const product = loaded.description === DESCRIPTION ? { ...loaded, description: t.product.description } : loaded;

  const crumbs = [
    { label: t.product.home, href: "/" },
    { label: t.product.products, href: "/catalogue" },
    ...(product.category
      ? [{ label: term(t, product.category.name), href: `/catalogue?category=${encodeURIComponent(product.category.slug)}` }]
      : []),
    ...(product.typology
      ? [
          {
            label: term(t, product.typology),
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
      <ProductDetails product={product} crumbs={<Breadcrumbs items={crumbs} />} />

      <ProductLine products={product.related} title={t.product.related} cta={null} className="pt-[120px]" />
    </div>
  );
}
