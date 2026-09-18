import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cn } from "@/lib/cn";
import { SiteHeader } from "@/components/site/Header";
import { Photo } from "@/components/ui/Photo";
import { DotButton } from "@/components/ui/Button";
import { PageHero, SectionLink } from "@/components/site/Sections";
import { ProductLine } from "@/components/home/HomeSections";
import { getFeaturedProducts } from "@/lib/products";
import { getBrand } from "@/data/brands";
import { PROJECTS } from "@/data/projects";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const brand = getBrand(slug);
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
  const brand = getBrand(slug);
  if (!brand) notFound();

  const cards = await getFeaturedProducts(9);

  const projects = PROJECTS;

  return (
    <div className="flex w-full flex-col gap-[120px] bg-cream">
      {/* Hero */}
      <section className="flex w-full flex-col gap-12">
        <div className="flex w-full flex-col gap-16 lg:gap-[100px]">
          <SiteHeader variant="solid" />
          <PageHero
            crumbs={[{ label: "Home", href: "/" }, { label: "Brands", href: "/brands" }, { label: brand.name }]}
            title={<span className="block max-w-[646px]">Explore {brand.name} Brand</span>}
            text="We don't chase trends — we represent brands for excellent design, high quality and timeless solutions, and we stay with them for years."
            button={{ label: "Book a consultation", href: "/contact" }}
          />
        </div>
        <hr className="border-line" />
      </section>

      {/* Signature collections */}
      <section className="flex w-full flex-col gap-10">
        <div className="mx-auto flex w-full max-w-[1440px] items-center justify-between px-4 md:px-10">
          <h2 className="text-[36px] font-medium leading-[1.1] tracking-[-0.04em] text-black md:text-[52px]">Signature collections</h2>
          <SectionLink href="/catalogue">See more</SectionLink>
        </div>
        <CardStrip>
          {brand.collections.map((c, i) => (
            <Link key={c.title} href="/catalogue" className="flex w-[300px] flex-col gap-4 lg:w-[360px]">
              <Photo src={`/images/brands/${brand.slug}-collection-${i + 1}.jpg`} tone="light" className={cn("w-full", COLLECTION_HEIGHT[c.height])} />
              <p className="text-[18px] font-medium leading-none tracking-[-0.04em] text-black">{c.title}</p>
            </Link>
          ))}
        </CardStrip>
      </section>

      {/* Projects */}
      <section className="flex w-full flex-col gap-10">
        <div className="mx-auto flex w-full max-w-[1440px] items-center justify-between px-4 md:px-10">
          <h2 className="text-[36px] font-medium leading-[1.1] tracking-[-0.04em] text-black md:text-[52px]">Projects</h2>
          <SectionLink href="/projects">See more</SectionLink>
        </div>
        <CardStrip>
          {projects.map((p, i) => (
            <Link
              key={p.slug}
              href={`/projects/${p.slug}`}
              data-cursor="View project"
              className={cn("flex flex-col gap-4", i === 0 ? "w-[300px] lg:w-[728px]" : "w-[300px] lg:w-[360px]")}
            >
              <Photo src={p.image} className={cn("w-full", i === 0 ? "h-[458px]" : "h-[366px]")} />
              <div className="flex flex-col gap-2 font-medium leading-none">
                <p className="text-[18px] tracking-[-0.04em] text-black">{p.name}</p>
                <p className="text-[13px] uppercase tracking-[-0.04em] text-body">{p.category}</p>
              </div>
            </Link>
          ))}
        </CardStrip>
      </section>

      <ProductLine products={cards} title="Product line" cta={{ label: "See more", href: "/catalogue" }} className="" />

      {/* CTA (Figma "section cta") */}
      <section className="w-full border-y border-line">
        <div className="mx-auto flex max-w-[1440px] flex-col lg:flex-row lg:items-stretch">
          <div className="flex flex-1 p-4 md:p-10">
            <Photo src={`/images/brands/${brand.slug}-cta.jpg`} className="min-h-[360px] w-full lg:min-h-[500px]" />
          </div>
          <div className="hidden w-px bg-line lg:block" />
          <div className="flex flex-1 flex-col items-center justify-center gap-8 p-4 text-center md:p-10 lg:aspect-square">
            <div className="flex flex-col gap-6">
              <h2 className="text-[36px] font-medium leading-none tracking-[-0.04em] text-black md:text-[46px]">
                A Complete Furniture Collection for Architects &amp; Designers
              </h2>
              <p className="text-[18px] leading-[1.3] tracking-[-0.04em] text-body">
                Reliable manufacturing, premium finishes, and solutions tailored to professional specifications.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <DotButton href="/catalogue">View products from this brand</DotButton>
              <DotButton variant="ghost" dots={false} href={`/contact?product=${encodeURIComponent(brand.name)}`}>Send enquiry</DotButton>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
