import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site/Header";
import { PageHero } from "@/components/site/Sections";
import { BRANDS } from "@/data/brands";
import { BrandMark } from "@/components/site/BrandMark";
import { PLACEHOLDER_IMAGE } from "@/lib/placeholder";

export const metadata: Metadata = {
  title: "Brands — Simetria LT",
  description: "Partner brands we trust: furniture and lighting manufacturers represented by Simetria.",
};

// Figma "Brands page" (node 4217:46278)
export default function BrandsPage() {
  return (
    <div className="flex w-full flex-col gap-[120px] bg-cream">
      <section className="flex w-full flex-col gap-16 lg:gap-[100px]">
        <SiteHeader variant="solid" />
        {/* PageHero brings its own 1440px container, so the grid gets a matching one instead of
            nesting inside a second padded wrapper (which pushed the hero 40px further right) */}
        <div className="flex w-full flex-col gap-[70px]">
          <PageHero
            title={<span className="block max-w-[837px]">Partner Brands We Trust</span>}
            titleClassName="xl:text-[106px]"
            text="We don't chase trends — we represent brands for excellent design, high quality and timeless solutions, and we stay with them for years."
            button={{ label: "Book a consultation", href: "/contact" }}
          />
          <ul className="mx-auto grid w-full max-w-[1440px] grid-cols-1 gap-2 px-4 pb-[120px] md:grid-cols-2 md:px-10 xl:grid-cols-3">
            {BRANDS.map((brand) => (
              <li key={brand.slug}>
                <Link
                  href={`/brands/${brand.slug}`}
                  className="group relative flex h-[270px] flex-col justify-between overflow-hidden border border-[#909090] p-10 text-[#111] transition-colors hover:border-cream hover:text-white"
                >
                  <span
                    aria-hidden
                    className="absolute inset-0 bg-cover bg-center opacity-0 transition-opacity group-hover:opacity-100"
                    style={{
                      backgroundImage: `url(${PLACEHOLDER_IMAGE ?? `/images/brands/${brand.slug}.jpg`}), linear-gradient(165deg, #4b4641 0%, #2b2825 55%, #171615 100%)`,
                    }}
                  />
                  <span className="relative w-[235px]">
                    <BrandMark brand={brand} />
                  </span>
                  <span className="relative flex flex-col gap-2">
                    <span className="text-[18px] font-semibold leading-none tracking-[-0.04em]">{brand.name}</span>
                    <span className="text-[14px] leading-[1.3] tracking-[-0.04em] text-label group-hover:text-tertiary">
                      {brand.category} · {brand.country}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
