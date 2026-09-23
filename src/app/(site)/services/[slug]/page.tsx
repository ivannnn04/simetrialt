import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site/Header";
import { DotButton } from "@/components/ui/Button";
import { Photo } from "@/components/ui/Photo";
import { ArrowIcon } from "@/components/ui/Icons";
import { LetsTalk, PageHero } from "@/components/site/Sections";
import { StagesTimeline } from "@/components/services/StagesTimeline";
import { getServicePage, SERVICE_SLUGS } from "@/data/services";

type Params = { slug: string };

export function generateStaticParams() {
  return SERVICE_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const service = getServicePage(slug);
  return service
    ? { title: `${service.title} — Simetria LT`, description: service.intro }
    : { title: "Service — Simetria LT" };
}

/** Figma "Services page: lighting" (node 4217:46064). */
export default async function ServicePage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const service = getServicePage(slug);
  if (!service) notFound();
  const { overview, recentWork } = service;

  return (
    <>
      {/* Hero (Figma "hero section") */}
      <section className="flex w-full flex-col gap-16 bg-cream pb-[120px] lg:gap-[100px]">
        <SiteHeader variant="solid" />
        <div className="flex w-full flex-col gap-8">
          <PageHero
            crumbs={[{ label: "Home", href: "/" }, { label: "Services", href: "/services" }, { label: service.breadcrumb }]}
            title={
              <>
                {service.titleLines[0]}
                <br />
                {service.titleLines[1]}
              </>
            }
            text={service.intro}
            button={{ label: "Book a consultation", href: "/contact" }}
          />
          <Photo src={service.heroImage} position="bottom" className="h-[360px] w-full sm:h-[420px] md:h-[480px] xl:aspect-[1440/512] xl:h-auto xl:min-h-[480px]">
            <div className="absolute inset-0 bg-black/10" />
          </Photo>
        </div>
      </section>

      {/* 2 section: overview (Figma node 4217:46068) */}
      <section className="w-full bg-cream px-4 md:px-10">
        <div className="mx-auto flex w-full max-w-[1360px] flex-col items-center gap-10">
          <h2 className="max-w-[654px] text-center text-[40px] font-medium leading-none tracking-[-0.04em] text-black md:text-[64px]">
            {overview.heading}
          </h2>
          <div className="flex w-full flex-col gap-10 lg:flex-row lg:items-stretch lg:justify-between">
            <Photo src={overview.image} className="aspect-[680/503] w-full lg:w-[680px] lg:shrink-0" />
            <div className="flex flex-col gap-10 lg:w-[575px]">
              <p className="text-[18px] leading-[1.3] tracking-[-0.04em] text-[#1f1f1f]">{overview.text}</p>
              <div className="flex flex-1 flex-col justify-between gap-10">
                <div className="flex flex-col gap-10 md:flex-row md:items-start md:gap-[78px]">
                  <ul className="flex w-full flex-col gap-3 md:w-[316px]">
                    {overview.points.map((point) => (
                      <li key={point} className="flex items-center gap-2 border-b border-line pb-3">
                        <ArrowIcon className="size-5 shrink-0 text-label" />
                        <span className="text-[15px] leading-[1.4] tracking-[-0.04em] text-label">{point}</span>
                      </li>
                    ))}
                  </ul>
                  <Photo src={overview.imageSmall} tone="light" className="h-[220px] w-[180px] shrink-0" />
                </div>
                <div>
                  <DotButton href="/contact">Book a consultation</DotButton>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3 section: how we work (Figma node 4048:30522): pt-120, title → 60 → timeline → 60 → image */}
      <section className="flex w-full flex-col gap-10 bg-cream pt-20 md:gap-[60px] md:pt-[120px]">
        <div className="flex w-full flex-col gap-10 md:gap-[60px]">
          <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-5 px-4 md:gap-[29px] md:px-10">
            <p className="text-[18px] leading-[1.3] tracking-[-0.04em] text-secondary">HOW WE WORK</p>
            <h2 className="max-w-[570px] text-[36px] font-medium leading-[1.1] tracking-[-0.04em] text-black md:text-[52px]">
              From brief to installation in the stages
            </h2>
          </div>
          <div className="w-full px-4 md:px-10 xl:px-0">
            <StagesTimeline stages={service.stages} />
          </div>
        </div>
        <Photo src={service.stagesImage} className="h-[280px] w-full sm:h-[340px] md:h-[400px] xl:aspect-[1440/461] xl:h-auto xl:min-h-[400px]" />
      </section>

      {/* 4 section: recent work (Figma node 4217:46084) */}
      <section className="flex w-full flex-col items-center gap-14 bg-cream pt-[120px]">
        <div className="flex max-w-[844px] flex-col items-center gap-6 px-4 text-center md:px-10">
          <p className="text-[18px] leading-[1.3] tracking-[-0.04em] text-secondary">{recentWork.eyebrow}</p>
          <h2 className="text-[40px] font-medium leading-none tracking-[-0.04em] text-black md:text-[64px]">{recentWork.heading}</h2>
        </div>
        <div className="flex w-full flex-col gap-4 px-4 md:px-10 lg:flex-row lg:justify-center">
          {recentWork.cards.map((card) => (
            <Link key={card.title} href={card.href} data-cursor="View project" className="group block w-full lg:w-[672px]">
              <Photo src={card.image} className="flex h-[480px] flex-col items-center justify-end gap-8 px-8 py-10 md:h-[700px] md:px-[100px]">
                <div className="absolute inset-0 bg-black/20 transition-colors duration-500 group-hover:bg-black/35" />
                <div className="relative flex flex-col items-center gap-2 text-center leading-none text-white">
                  <p className="text-[12px] tracking-[-0.04em]">{card.category}</p>
                  <p className="text-[36px] font-medium tracking-[-0.04em] md:text-[50px]">{card.title}</p>
                </div>
                <span className="relative rounded-[20px] bg-cream/30 px-3 py-1.5 text-[14px] leading-[1.3] tracking-[-0.04em] text-white backdrop-blur-[9px]">
                  {card.tag}
                </span>
              </Photo>
            </Link>
          ))}
        </div>
      </section>

      <LetsTalk />
    </>
  );
}
