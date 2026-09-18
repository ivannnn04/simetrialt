import { cn } from "@/lib/cn";
import { DotButton } from "@/components/ui/Button";
import { Photo } from "@/components/ui/Photo";
import type { ProductCardData } from "@/components/catalogue/ProductCard";
import { ProductSlider } from "@/components/catalogue/ProductSlider";
import { Badge } from "@/components/site/Sections";
import { SiteHeader } from "@/components/site/Header";
import { FeatureSlider, type FeatureSlide } from "@/components/home/FeatureSlider";

// ---------- Hero (Figma node 4189:40696) ----------

export function Hero() {
  return (
    <section className="relative w-full">
      <Photo src="/images/home/hero.jpg" className="w-full">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0)_0%,rgba(0,0,0,0.5)_100%)]" />
        <SiteHeader variant="overlay" />
        <div className="relative mx-auto flex max-w-[1440px] flex-col gap-24 px-4 pb-10 pt-[200px] md:px-10 lg:gap-[280px] lg:pt-[356px]">
          <p className="max-w-[417px] text-[16px] leading-[1.3] tracking-[-0.04em] text-white">
            For long-term projects with real volume — hotels, offices, residential developments — Simetria sources,
            specifies and delivers from a single point of accountability.
          </p>
          <div className="flex flex-col gap-10 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-wrap items-center gap-4">
              <DotButton variant="primary" href="/catalogue">Explore products</DotButton>
              <DotButton variant="ghost-light" dots={false} href="/contact">Book a consultation</DotButton>
            </div>
            <div className="flex flex-col gap-[15px] lg:items-end lg:text-right">
              <Badge className="text-white">Design house, established for architects</Badge>
              <h1 className="max-w-[824px] text-[40px] font-medium leading-none tracking-[-0.04em] text-white md:text-[64px]">
                Furniture and lighting
                <br />
                solutions for architects
                <br />
                who build at scale
              </h1>
            </div>
          </div>
        </div>
      </Photo>
    </section>
  );
}

// ---------- Why architects work with us (Figma node 4188:22472 / 4189:22881) ----------

export function WhySection() {
  return (
    <section className="w-full bg-cream px-4 py-[120px] md:px-10 lg:py-[240px]">
      <div className="mx-auto flex max-w-[1440px] flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-4 text-center">
          <Badge className="text-ink">Why architects work with us</Badge>
          <h2 className="max-w-[725px] text-[40px] font-medium leading-none tracking-[-0.04em] text-ink md:text-[64px]">
            Everything architects need in a design partner
          </h2>
        </div>
        <DotButton href="#features">Scroll</DotButton>
        <Photo src="/images/home/why.jpg" className="mt-8 h-[434px] w-[334px]">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/50 to-black/70" />
        </Photo>
      </div>
    </section>
  );
}

// ---------- Long-term partnerships (Figma "features", node 4048:30474) ----------

type FeaturesProps = {
  slides: FeatureSlide[];
  image?: string;
};

export function FeaturesSection({ slides, image = "/images/home/features.jpg" }: FeaturesProps) {
  return (
    <section id="features" className="w-full">
      <Photo src={image} className="w-full">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/50 to-black/70" />
        <div className="relative pt-[320px] lg:pt-[526px]">
          <FeatureSlider slides={slides} />
        </div>
      </Photo>
    </section>
  );
}

// ---------- Our product line (Figma "products best", node 4189:23079) ----------

type ProductLineProps = {
  products: ProductCardData[];
  title?: string;
  cta?: { label: string; href: string };
  className?: string;
};

export function ProductLine({
  products,
  title = "Our product line",
  cta = { label: "Catalog", href: "/catalogue" },
  className = "pt-[120px]",
}: ProductLineProps) {
  return (
    <section className={cn("w-full bg-cream px-4 md:px-10", className)}>
      <div className="mx-auto flex max-w-[1440px] flex-col items-center gap-10">
        <ProductSlider
          products={products}
          title={<h2 className="text-[36px] font-medium leading-[1.1] tracking-[-0.04em] text-ink md:text-[52px]">{title}</h2>}
        />
        <DotButton href={cta.href}>{cta.label}</DotButton>
      </div>
    </section>
  );
}

// ---------- Brands (Figma "logo section", node 4048:30689) ----------

const BRANDS = ["Kartell", "Moooi", "Luceplan", "Dorelan", "Marset", "Tom Dixon", "Flos", "Vibia"];

export function BrandsSection() {
  // The strip is duplicated so the marquee can loop seamlessly (translateX -50%).
  const strip = [...BRANDS, ...BRANDS];
  return (
    <section id="brands" className="w-full overflow-hidden bg-cream py-[120px]">
      <div className="flex flex-col items-center gap-6">
        <p className="text-center text-[18px] leading-[1.3] tracking-[-0.04em] text-secondary">BRANDS WE REPRESENT</p>
        <div className="brands-marquee w-full overflow-hidden" aria-label="Brands we represent">
          <ul className="brands-track flex w-max items-center gap-[15px] pr-[15px]">
            {strip.map((brand, i) => (
              <li
                key={`${brand}-${i}`}
                aria-hidden={i >= BRANDS.length}
                className="flex h-24 w-[233px] shrink-0 items-center justify-center border border-line"
              >
                <span className="text-[22px] font-semibold lowercase tracking-[-0.04em] text-ink">{brand}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

// ---------- About (Figma node 4217:47660) ----------

const NUMBERS = [
  ["140", "Rooms"],
  ["40", "Projects"],
  ["15", "Brands"],
];

export function AboutSection() {
  return (
    <section id="about" className="w-full">
      <Photo src="/images/home/about.jpg" className="w-full">
        <div className="absolute inset-0 bg-black/30" />
        <div className="relative mx-auto flex min-h-[750px] max-w-[1440px] flex-col justify-end gap-6">
          <div className="flex flex-col gap-6 px-4 md:px-10 lg:flex-row lg:items-end lg:justify-between">
            <h2 className="max-w-[554px] text-[36px] font-medium leading-[1.1] tracking-[-0.04em] text-cream md:text-[52px]">
              Furniture Solutions Without Complexity
            </h2>
            <div>
              <DotButton variant="primary" href="/contact">About Us</DotButton>
            </div>
          </div>
          <div className="flex flex-col border-t border-cream/40 lg:flex-row lg:items-stretch">
            <div className="flex items-center px-4 py-6 md:px-10 lg:h-[137px] lg:w-1/2">
              <p className="max-w-[554px] text-[16px] leading-[1.3] tracking-[-0.04em] text-cream">
                Simetria is a premium design showroom and project partner, delivering curated furniture and lighting
                solutions through expert sourcing, specification, procurement, and seamless project execution.
              </p>
            </div>
            <div className="flex items-center gap-6 border-t border-cream/40 px-4 py-6 text-white md:gap-[50px] lg:h-[137px] lg:w-1/2 lg:justify-center lg:border-l lg:border-t-0 lg:px-0 lg:py-0">
              {NUMBERS.map(([n, label]) => (
                <div key={label} className="flex flex-col gap-1.5 border-l border-cream/40 px-4">
                  <p className="text-[44px] font-medium leading-none tracking-[-0.04em] md:text-[64px]">{n}</p>
                  <p className="text-[18px] leading-[1.3] tracking-[-0.04em]">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Photo>
    </section>
  );
}
