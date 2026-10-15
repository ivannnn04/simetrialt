import type { Metadata } from "next";
import { SiteHeader } from "@/components/site/Header";
import { Photo } from "@/components/ui/Photo";
import { CtaSection, LetsTalk, PageHero } from "@/components/site/Sections";
import { FeaturesSection } from "@/components/home/HomeSections";
import { getT } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return (await getT()).aboutPage.meta;
}

const YEARS = ["12", "9", "7"];

const TEAM = ["Alexander Wright", "Regina Feil", "Phillip Nienow", "Michael Kub", "Carol Steuber", "Alberta Macejkovic", "Terri Wisozk", "Erica Barrows"];

// Figma "About Us page" (node 4217:46302; Lithuanian 4217:48341)
export default async function AboutPage() {
  const t = await getT();
  const a = t.aboutPage;
  return (
    <>
      <section className="flex w-full flex-col gap-16 bg-cream lg:gap-[100px]">
        <SiteHeader variant="solid" />
        <div className="flex w-full flex-col gap-8">
          <PageHero
            crumbs={[{ label: a.home, href: "/" }, { label: a.about }]}
            title={
              <>
                {a.title[0]}
                <br />
                {a.title[1]}
              </>
            }
            text={a.text}
            button={{ label: a.book, href: "/contact" }}
          />
          <Photo src="/images/about/hero.jpg" position="bottom" className="h-[360px] w-full sm:h-[420px] md:h-[480px] xl:aspect-[1440/512] xl:h-auto xl:min-h-[480px]" />
        </div>
      </section>

      {/* About + years (Figma 4217:46310): full-width divider lines, content inside the container, rows overlap by 24px */}
      <section className="flex w-full flex-col gap-20 py-[120px]">
        <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 md:px-10">
          <p className="text-[18px] leading-[1.3] tracking-[-0.04em] text-secondary">{a.aboutUs}</p>
          <p className="text-[24px] font-medium leading-[1.1] tracking-[-0.04em] text-black md:text-[46px] md:leading-none">{a.intro}</p>
        </div>
        <div className="flex w-full flex-col">
          {YEARS.map((years, i) => (
            <div
              key={years}
              // Figma: rows overlap by 24px; each row has the page background and sits above the
              // previous one, so the bottom of the previous digits is cut off by the divider line.
              className="relative w-full border-t border-line bg-cream md:-mb-6"
              style={{ zIndex: i + 1 }}
            >
              <div className="mx-auto flex w-full max-w-[1440px] flex-col px-4 pt-6 md:flex-row md:items-start md:gap-12 md:px-10 lg:gap-[100px] lg:pl-[180px] xl:gap-[156px] xl:pl-[320px]">
                <div className="flex w-[250px] shrink-0 items-start gap-2">
                  <span className="text-[96px] font-medium leading-none tracking-[-0.04em] text-black md:text-[134px]">{years}</span>
                  <span className="py-8 text-[13px] leading-[1.3] tracking-[-0.04em] text-black">{a.years}</span>
                </div>
                <div className="flex min-w-0 flex-1 items-center justify-between gap-8 py-8 text-[18px] leading-[1.3] tracking-[-0.04em] text-[#1f1f1f]">
                  <p className="max-w-[380px]">{a.yearRows[i]}</p>
                  <p className="whitespace-nowrap">({String(i + 1).padStart(2, "0")})</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <FeaturesSection image="/images/about/features.jpg" slides={a.features} />

      <CtaSection
        eyebrow={a.cta.eyebrow}
        image="/images/about/cta.jpg"
        title={a.cta.title}
        text={a.cta.text}
        button={{ label: a.cta.button, href: "/projects" }}
      />

      {/* Team */}
      <section className="mx-auto flex w-full max-w-[1440px] flex-col gap-10 px-4 pb-[120px] md:px-10">
        <h2 className="text-[36px] font-medium leading-[1.1] tracking-[-0.04em] text-black md:text-[52px]">{a.team}</h2>
        <ul className="grid grid-cols-1 gap-x-[14px] gap-y-12 sm:grid-cols-2 xl:grid-cols-4">
          {TEAM.map((name, i) => (
            <li key={name} className="flex flex-col gap-4">
              <Photo src={`/images/about/team-${i + 1}.jpg`} tone="light" className="h-[420px] w-full" />
              <div className="flex flex-col gap-2">
                <p className="text-[18px] font-semibold leading-none tracking-[-0.04em] text-black">{name}</p>
                <p className="text-[14px] leading-[1.3] tracking-[-0.04em] text-body">{a.roles[i]}</p>
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
              {a.banner.title}
            </h2>
            <p className="max-w-[460px] text-[18px] leading-[1.3] tracking-[-0.04em] text-white">{a.banner.text}</p>
          </div>
        </Photo>
      </section>

      <LetsTalk />
    </>
  );
}
