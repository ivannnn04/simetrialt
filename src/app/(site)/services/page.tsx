import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site/Header";
import { DotButton } from "@/components/ui/Button";
import { Photo } from "@/components/ui/Photo";
import { CtaSection, LetsTalk, ServicesList } from "@/components/site/Sections";
import { ProjectsSlider } from "@/components/home/ProjectsSlider";
import { PROJECT_SLIDES, PROJECT_SLIDES_IMAGE } from "@/data/project-slides";
import { cn } from "@/lib/cn";

export const metadata: Metadata = {
  title: "Services — Simetria LT",
  description: "Professional interior solutions: lighting design, smart home systems, bespoke interiors, installation.",
};

// Figma "3 section" — process cards (node 4217:47508)
const PROCESS = [
  {
    number: "01",
    title: "Consultation & Project Discovery",
    text: "We meet on site or in the showroom, study the brief and drawings, and agree on scope, budget and timeline before anything is specified.",
    image: "/images/services/process-1.jpg",
    href: "/contact",
  },
  {
    number: "02",
    title: "Selection & Proposal",
    text: "Our team shortlists furniture and lighting from the brands we represent, prepares samples and a priced proposal with lead times.",
    image: "/images/services/process-2.jpg",
    href: "/catalogue",
  },
  {
    number: "03",
    title: "Order & Coordination",
    text: "We place and track every order, align deliveries with the construction schedule and keep one point of contact for the whole project.",
    image: "/images/services/process-3.jpg",
    href: "/projects",
  },
  {
    number: "04",
    title: "Delivery & Project Completion",
    text: "Installation, commissioning and a final walkthrough, followed by after-sales support for as long as the space is in use.",
    image: "/images/services/process-4.jpg",
    href: "/contact",
  },
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
          <Photo src="/images/services/hero.jpg" position="bottom" className="h-[360px] w-full sm:h-[420px] md:h-[480px] xl:aspect-[1440/512] xl:h-auto xl:min-h-[480px]" />
        </div>
      </section>

      <ServicesList stack />

      {/* Process cards: each is a link; hovering one reveals its description and dims the other three */}
      <section className="group/process grid w-full grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
        {PROCESS.map((step) => (
          <Link
            key={step.number}
            href={step.href}
            className="group/card relative block"
          >
            <Photo src={step.image} className="flex h-[480px] flex-col items-center justify-center px-8 xl:h-[660px]">
              <div className="absolute inset-0 bg-black/10 transition-colors duration-500 ease-out group-hover/process:bg-black/60 group-hover/card:!bg-black/25" />
              <div className="relative flex max-w-[320px] flex-col items-center text-center text-white">
                <h2 className="text-[30px] font-medium leading-[1.3] tracking-[-0.04em]">{step.title}</h2>
                <div className="grid grid-rows-[0fr] transition-[grid-template-rows] duration-500 ease-out group-hover/card:grid-rows-[1fr]">
                  <p
                    className={cn(
                      "overflow-hidden text-[16px] leading-[1.3] tracking-[-0.04em] text-white/90 opacity-0 transition-[opacity,transform] duration-500 ease-out",
                      "translate-y-2 group-hover/card:translate-y-0 group-hover/card:opacity-100"
                    )}
                  >
                    <span className="block pt-4">{step.text}</span>
                  </p>
                </div>
              </div>
              <p className="absolute bottom-8 text-[18px] leading-[1.3] tracking-[-0.04em] text-white">/ {step.number}</p>
            </Photo>
          </Link>
        ))}
      </section>

      <CtaSection
        eyebrow="Check out our projects"
        image="/images/services/cta.jpg"
        title="A dedicated design partner for full-cycle lighting development and interior solutions."
        text="Calculations, compliance, smart integration, and custom fixtures."
        button={{ label: "Scroll", href: "#projects" }}
      />

      <ProjectsSlider image={PROJECT_SLIDES_IMAGE} slides={PROJECT_SLIDES} />
      <LetsTalk />
    </>
  );
}
