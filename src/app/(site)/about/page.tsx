import type { Metadata } from "next";
import { SiteHeader } from "@/components/site/Header";
import { Photo } from "@/components/ui/Photo";
import { CtaSection, LetsTalk, PageHero } from "@/components/site/Sections";
import { FeaturesSection } from "@/components/home/HomeSections";

export const metadata: Metadata = {
  title: "About — Simetria LT",
  description: "Discover the Simetria system: curated sourcing, precise calculations and dedicated technical support.",
};

const YEARS = [
  { years: "12", text: "Representing Marset in the Baltics." },
  { years: "9", text: "Representing Sancal across hospitality and residential projects." },
  { years: "7", text: "Representing Pedrali for large-scale commercial fit-outs." },
];

const TEAM = [
  ["Alexander Wright", "Managing Director & Head of Curation"],
  ["Regina Feil", "Central Applications Orchestrator"],
  ["Phillip Nienow", "Human Usability Consultant"],
  ["Michael Kub", "Central Mobility Technician"],
  ["Carol Steuber", "Human Program Director"],
  ["Alberta Macejkovic", "Senior Implementation Director"],
  ["Terri Wisozk", "Product Research Specialist"],
  ["Erica Barrows", "Future Creative Consultant"],
];

// Figma "About Us page" (node 4217:46302)
export default function AboutPage() {
  return (
    <>
      <section className="flex w-full flex-col gap-16 bg-cream lg:gap-[100px]">
        <SiteHeader variant="solid" />
        <div className="flex w-full flex-col gap-8">
          <PageHero
            crumbs={[{ label: "Home", href: "/" }, { label: "About" }]}
            title={
              <>
                Discover the
                <br />
                Simetria system
              </>
            }
            text="Curated product sourcing, precise calculations, and dedicated technical support for professional architects and interior designers"
            button={{ label: "Book a consultation", href: "/contact" }}
          />
          <Photo src="/images/about/hero.jpg" position="bottom" className="aspect-[1440/512] w-full" />
        </div>
      </section>

      {/* About + years */}
      <section className="mx-auto flex w-full max-w-[1440px] flex-col gap-20 py-[120px]">
        <div className="flex flex-col gap-6 px-4 md:px-10">
          <p className="text-[18px] leading-[1.3] tracking-[-0.04em] text-secondary">About us</p>
          <p className="text-[32px] font-medium leading-none tracking-[-0.04em] text-black md:text-[46px]">
            We specialize in lighting project development, calculations, compliance, smart integration, and custom
            fixtures. From concept to handover, we manage every detail to ensure your design vision is flawlessly
            realized.
          </p>
        </div>
        <div className="flex flex-col">
          {YEARS.map((row, i) => (
            <div key={row.years} className="flex flex-col border-t border-line pt-6 md:flex-row md:items-start md:gap-[156px] md:pl-[320px]">
              <div className="flex w-[250px] items-start px-4 md:px-0">
                <span className="text-[96px] font-medium leading-none tracking-[-0.04em] text-black md:text-[134px]">{row.years}</span>
                <span className="py-8 text-[13px] leading-[1.3] tracking-[-0.04em] text-black">(years)</span>
              </div>
              <div className="flex flex-1 items-center justify-between gap-8 px-4 py-8 text-[18px] leading-[1.3] tracking-[-0.04em] text-[#1f1f1f] md:pl-0 md:pr-10">
                <p className="max-w-[380px]">{row.text}</p>
                <p className="whitespace-nowrap">({String(i + 1).padStart(2, "0")})</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <FeaturesSection
        image="/images/about/features.jpg"
        slides={[
          { title: "Personalised approach", text: "Every project is treated as unique, tailoring our curation and support precisely to your specific requirements." },
          { title: "Technical precision", text: "Lighting calculations, compliance checks and specification sheets prepared by our own engineers." },
          { title: "Reliable delivery", text: "Consolidated logistics and on-site coordination so every piece arrives on time and in place." },
          { title: "Support after handover", text: "Maintenance, spare parts and adjustments long after the project is complete." },
        ]}
      />

      <CtaSection
        eyebrow="Explore Our Portfolio"
        image="/images/about/cta.jpg"
        title="Proven expertise shaping inspiring interiors through meticulous collaboration"
        text="Sourcing, Calculations, Architectural Support, and Execution."
        button={{ label: "View Portfolio", href: "/projects" }}
      />

      {/* Team */}
      <section className="mx-auto flex w-full max-w-[1440px] flex-col gap-10 px-4 pb-[120px] md:px-10">
        <h2 className="text-[36px] font-medium leading-[1.1] tracking-[-0.04em] text-black md:text-[52px]">Our team</h2>
        <ul className="grid grid-cols-1 gap-x-[14px] gap-y-12 sm:grid-cols-2 xl:grid-cols-4">
          {TEAM.map(([name, role], i) => (
            <li key={name} className="flex flex-col gap-4">
              <Photo src={`/images/about/team-${i + 1}.jpg`} tone="light" className="h-[420px] w-full" />
              <div className="flex flex-col gap-2">
                <p className="text-[18px] font-semibold leading-none tracking-[-0.04em] text-black">{name}</p>
                <p className="text-[14px] leading-[1.3] tracking-[-0.04em] text-body">{role}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Banner */}
      <section className="w-full">
        <Photo src="/images/about/banner.jpg" position="bottom" className="w-full">
          <div className="absolute inset-0 bg-black/[0.32]" />
          <div className="relative mx-auto flex min-h-[531px] max-w-[1440px] flex-col justify-between gap-10 px-4 py-[100px] md:px-10">
            <h2 className="max-w-[672px] text-[36px] font-medium leading-[1.1] tracking-[-0.04em] text-white md:text-[52px]">
              Precision lighting design and furnishing solutions crafted for professional spaces.
            </h2>
            <p className="max-w-[460px] text-[18px] leading-[1.3] tracking-[-0.04em] text-white">
              From initial concept layout to final fixture installation, we provide comprehensive technical support,
              accurate calculations, and curated product sourcing.
            </p>
          </div>
        </Photo>
      </section>

      <LetsTalk />
    </>
  );
}
