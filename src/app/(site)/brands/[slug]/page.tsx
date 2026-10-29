import type { Metadata } from "next";
import Link from "@/components/ui/Link";
import { notFound } from "next/navigation";
import { cn } from "@/lib/cn";
import { SiteHeader } from "@/components/site/Header";
import { Photo } from "@/components/ui/Photo";
import { DotButton } from "@/components/ui/Button";
import { PageHero, SectionLink } from "@/components/site/Sections";
import { ProductLine } from "@/components/home/HomeSections";
import { getBrandCatalogue, getFeaturedProducts } from "@/lib/products";
import { getBrandBySlug, getProjects } from "@/lib/site-content";
import { getLocale, getT } from "@/i18n/server";
import { DEFAULT_LOCALE } from "@/i18n/config";
import { term, termParts } from "@/i18n/dictionaries";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const brand = await getBrandBySlug(slug);
  return { title: brand ? `${brand.name} — Simetria LT` : "Brand — Simetria LT" };
}

const COLLECTION_HEIGHT = { 458: "h-[458px]", 366: "h-[366px]", 275: "h-[275px]" } as const;

/**
 * Horizontal card strip (Figma "cards section"): starts at the container's left edge, runs to
 * the viewport's right edge, scrolls horizontally with the scrollbar hidden.
 */
function CardStrip({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="flex w-max gap-2 pl-4 pr-4 md:pl-[max(40px,calc((100vw-1440px)/2+40px))] md:pr-10">{children}</div>
    </div>
  );
}


// Figma "Brand's internal page UPD" (node 4217:47603)
export default async function BrandPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const brand = await getBrandBySlug(slug);
  if (!brand) notFound();

  const [own, t, allProjects, locale] = await Promise.all([getBrandCatalogue(brand.name, 9), getT(), getProjects(), getLocale()]);
  const lt = locale !== DEFAULT_LOCALE;
  // only projects whose credits name this brand
  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  const brandKey = norm(brand.name);
  const brandWord = brandKey.split(" ")[0];
  const projects = allProjects.filter((p) => {
    const credits = ` ${norm(p.specs.map(([, v]) => v).join(" "))} `;
    return credits.includes(` ${brandKey} `) || (brandWord.length >= 4 && credits.includes(` ${brandWord} `));
  });
  const d = t.brandsPage.detail;
  // the brand's own products; the sample strip stays only while a brand has nothing in the catalogue yet
  const hasProducts = own.cards.length > 0;
  const cards = hasProducts ? own.cards : await getFeaturedProducts(9);
  const catalogueHref = hasProducts ? `/catalogue?brand=${encodeURIComponent(own.brandValue)}` : "/catalogue";
  const typologyHref = (typology: string) => `${catalogueHref}&typology=${encodeURIComponent(typology)}`;

  return (
    <div className="flex w-full flex-col gap-[120px] bg-cream pb-10 md:pb-[120px]">
      {/* Hero */}
      <section className="flex w-full flex-col gap-12">
        <div className="flex w-full flex-col gap-16 lg:gap-[100px]">
          <SiteHeader variant="solid" />
          <PageHero
            crumbs={[{ label: d.home, href: "/" }, { label: d.brands, href: "/brands" }, { label: brand.name }]}
            title={<span className="block max-w-[900px]">{d.title(brand.name)}</span>}
            text={t.brandsPage.text}
            button={{ label: t.brandsPage.book, href: "/contact" }}
          />
        </div>
        <hr className="border-line" />
      </section>

      {/* Signature collections */}
      <section className="flex w-full flex-col gap-10">
        <div className="mx-auto flex w-full max-w-[1440px] flex-col items-start gap-4 px-4 min-[480px]:flex-row min-[480px]:items-center min-[480px]:justify-between min-[480px]:gap-6 md:px-10">
          <h2 className="text-[36px] font-medium leading-[1.1] tracking-[-0.04em] text-black md:text-[52px]">{d.collections}</h2>
          <SectionLink href={catalogueHref}>{d.seeMore}</SectionLink>
        </div>
        <CardStrip>
          {hasProducts
            ? own.typologies.map((c, i) => (
                <Link key={c.typology} href={typologyHref(c.typology)} className="flex w-[300px] flex-col gap-4 lg:w-[360px]">
                  <Photo src={c.image ?? `/images/brands/${brand.slug}-collection-${(i % 3) + 1}.jpg`} tone="light" position="center" className={cn("w-full bg-white", i % 3 === 0 ? COLLECTION_HEIGHT[458] : i % 3 === 1 ? COLLECTION_HEIGHT[366] : COLLECTION_HEIGHT[275])} />
                  <p className="text-[18px] font-medium leading-none tracking-[-0.04em] text-black">
                    {term(t, c.typology)} <span className="text-body">· {c.count}</span>
                  </p>
                </Link>
              ))
            : brand.collections.map((c, i) => (
                <Link key={c.title} href="/catalogue" className="flex w-[300px] flex-col gap-4 lg:w-[360px]">
                  <Photo src={`/images/brands/${brand.slug}-collection-${i + 1}.jpg`} tone="light" className={cn("w-full", COLLECTION_HEIGHT[c.height])} />
                  <p className="text-[18px] font-medium leading-none tracking-[-0.04em] text-black">{term(t, c.title)}</p>
                </Link>
              ))}
        </CardStrip>
      </section>

      {/* Projects that used this brand */}
      {projects.length > 0 && <section className="flex w-full flex-col gap-10">
        <div className="mx-auto flex w-full max-w-[1440px] flex-col items-start gap-4 px-4 min-[480px]:flex-row min-[480px]:items-center min-[480px]:justify-between min-[480px]:gap-6 md:px-10">
          <h2 className="text-[36px] font-medium leading-[1.1] tracking-[-0.04em] text-black md:text-[52px]">{d.projects}</h2>
          <SectionLink href="/projects">{d.seeMore}</SectionLink>
        </div>
        <CardStrip>
          {projects.map((p, i) => (
            <Link
              key={p.slug}
              href={`/projects/${p.slug}`}
              data-cursor={d.viewProject}
              className={cn("flex flex-col gap-4", i === 0 ? "w-[300px] lg:w-[728px]" : "w-[300px] lg:w-[360px]")}
            >
              <Photo src={p.image} className={cn("w-full", i === 0 ? "h-[458px]" : "h-[366px]")} />
              <div className="flex flex-col gap-2 font-medium leading-none">
                <p className="text-[18px] tracking-[-0.04em] text-black">{(lt && p.lt?.name) || p.name}</p>
                <p className="text-[13px] uppercase tracking-[-0.04em] text-body">{(lt && p.lt?.category) || termParts(t, p.category)}</p>
              </div>
            </Link>
          ))}
        </CardStrip>
      </section>}

      <ProductLine products={cards} title={d.productLine} cta={{ label: d.seeMore, href: catalogueHref }} className="" />

      {/* CTA (Figma "section cta") */}
      <section className="w-full lg:border-y lg:border-line">
        <div className="mx-auto flex max-w-[1440px] flex-col lg:flex-row lg:items-stretch">
          <div className="flex flex-1 p-4 md:p-10">
            <Photo src={`/images/brands/${brand.slug}-cta.jpg`} className="min-h-[360px] w-full lg:min-h-[500px]" />
          </div>
          <div className="hidden w-px bg-line lg:block" />
          <div className="flex flex-1 flex-col items-center justify-center gap-8 p-4 text-center md:p-10 lg:aspect-square">
            <div className="flex flex-col gap-6">
              <h2 className="text-[36px] font-medium leading-none tracking-[-0.04em] text-black md:text-[46px]">
                {d.ctaTitle}
              </h2>
              <p className="text-[18px] leading-[1.3] tracking-[-0.04em] text-body">{d.ctaText}</p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <DotButton href={catalogueHref} className="max-w-full text-center max-[399px]:whitespace-normal!">{d.viewProducts}</DotButton>
              <DotButton variant="ghost" dots={false} href={`/contact?product=${encodeURIComponent(brand.name)}`}>{d.enquiry}</DotButton>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
