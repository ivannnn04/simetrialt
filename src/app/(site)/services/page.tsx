import type { Metadata } from "next";
import { SiteHeader } from "@/components/site/Header";
import { DotButton } from "@/components/ui/Button";
import { Photo } from "@/components/ui/Photo";
import { CtaSection, LetsTalk, ProjectsSection, ServicesList } from "@/components/site/Sections";

export const metadata: Metadata = {
  title: "Services — Simetria LT",
  description: "Professional interior solutions: lighting design, smart home systems, bespoke interiors, installation.",
};

// Figma "3 section" — process cards (node 4217:47508)
const PROCESS = [
  { number: "01", title: "Consultation & Project Discovery", image: "/images/services/process-1.jpg" },
  { number: "02", title: "Selection & Proposal", image: "/images/services/process-2.jpg" },
  { number: "03", title: "Order & Coordination", image: "/images/services/process-3.jpg" },
  { number: "04", title: "Delivery & Project Completion", image: "/images/services/process-4.jpg" },
];

export default function ServicesPage() {
  return (
    <>
      {/* Hero (Figma node 4217:47503) */}
      <section className="flex w-full flex-col gap-16 bg-cream pb-[120px] lg:gap-[100px]">
        <SiteHeader variant="solid" />
        <div className="flex w-full flex-col gap-8">
          <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-10 px-4 md:px-10 lg:flex-row lg:items-end">
            <h1 className="flex-1 text-[56px] font-medium leading-[0.92] tracking-[-0.04em] text-black md:text-[80px] xl:text-[105px]">
              Professional
              <br />
              interior solutions
            </h1>
            <div className="flex flex-col gap-6 lg:w-[382px] lg:shrink-0">
              <p className="text-[16px] leading-[1.3] tracking-[-0.04em] text-[#2b2b2b]">
                Bridging the gap between design vision and technical reality through expert sourcing, precise
                specification, and project-wide accountability.
              </p>
              <div>
                <DotButton href="/contact">Book a consultation</DotButton>
              </div>
            </div>
          </div>
          <Photo src="/images/services/hero.jpg" position="bottom" className="aspect-[1440/512] w-full" />
        </div>
      </section>

      <ServicesList />

      {/* Process cards */}
      <section className="grid w-full grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
        {PROCESS.map((step) => (
          <Photo key={step.number} src={step.image} className="flex h-[480px] flex-col items-center justify-center px-8 xl:h-[660px]">
            <div className="absolute inset-0 bg-black/10" />
            <h2 className="relative max-w-[287px] text-center text-[30px] font-medium leading-[1.3] tracking-[-0.04em] text-white">
              {step.title}
            </h2>
            <p className="absolute bottom-8 text-[18px] leading-[1.3] tracking-[-0.04em] text-white">/ {step.number}</p>
          </Photo>
        ))}
      </section>

      <CtaSection
        eyebrow="Check out our projects"
        image="/images/services/cta.jpg"
        title="A dedicated design partner for full-cycle lighting development and interior solutions."
        text="Calculations, compliance, smart integration, and custom fixtures."
        button={{ label: "Scroll", href: "#projects" }}
      />

      <ProjectsSection />
      <LetsTalk />
    </>
  );
}
