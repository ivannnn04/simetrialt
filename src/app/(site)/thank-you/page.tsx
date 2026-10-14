import type { Metadata } from "next";
import { SiteHeader } from "@/components/site/Header";
import { DotButton } from "@/components/ui/Button";
import { ProductLine } from "@/components/home/HomeSections";
import { OrderDetails, SAMPLE_ORDER } from "@/components/order/OrderDetails";
import { getFeaturedProducts } from "@/lib/products";
import { getT } from "@/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).thankYou.meta };
}

// Figma "thank you page" (node 4217:46494): shown after an order is placed.
export default async function ThankYouPage() {
  const [products, t] = await Promise.all([getFeaturedProducts(6), getT()]);
  const y = t.thankYou;

  return (
    <div className="flex w-full flex-col bg-cream pb-10 md:pb-[120px]">
      <SiteHeader variant="solid" />
      <section className="mx-auto flex w-full max-w-[1440px] flex-col items-center gap-10 px-4 pt-[100px] md:px-10">
        <div className="flex max-w-[884px] flex-col items-center gap-6 text-center">
          <h1 className="text-[48px] font-medium leading-[0.9] tracking-[-0.04em] text-black md:text-[64px] xl:whitespace-nowrap xl:text-[84px]">
            {y.title}
          </h1>
          <p className="max-w-[392px] text-[15px] leading-[1.4] tracking-[-0.04em] text-body">
            {y.text}
          </p>
        </div>
        <DotButton href="/catalogue">{y.back}</DotButton>
        <OrderDetails items={SAMPLE_ORDER} />
      </section>

      <ProductLine products={products} title={y.related} cta={null} className="pt-[120px]" />
    </div>
  );
}
