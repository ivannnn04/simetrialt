import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site/Header";
import { Photo } from "@/components/ui/Photo";
import { BackLink } from "@/components/ui/Button";
import { LetsTalk } from "@/components/site/Sections";
import { ImageStrip } from "@/components/projects/ImageStrip";
import { getProjectBySlug } from "@/lib/site-content";
import { getLocale, getT } from "@/i18n/server";
import { DEFAULT_LOCALE } from "@/i18n/config";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const project = await getProjectBySlug(slug);
  return { title: project ? `${project.name} — Simetria LT` : "Project — Simetria LT" };
}

// Figma "Case page / ver 2 / upd 06.08" (node 4217:47559)
export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = await getProjectBySlug(slug);
  if (!project) notFound();
  const img = (n: string) => `/images/projects/${project.slug}/${n}.jpg`;
  // imported / edited projects carry their own photos; the first one is the hero
  const g = project.gallery?.filter(Boolean) ?? [];
  const own = g.length > 0;
  const photo = {
    hero: own ? g[0] : img("hero"),
    strip: own ? (g.length > 1 ? g.slice(1) : g) : ["1", "2", "3", "4", "5", "6", "7"].map(img),
    detail: own ? (g[1] ?? g[0]) : img("4"),
    wide: own ? g[2] : img("5"),
    light: own ? g[3] : img("6"),
    end: own ? g[4] : img("7"),
  };
  const t = await getT();
  const c = t.casePage;
  // Every project shares the same body copy for now; other locales take it from the dictionary.
  const localized = (await getLocale()) !== DEFAULT_LOCALE;
  const copy = localized && project.lt
    ? project.lt
    : localized
    ? {
        aboutTitle: c.aboutTitle,
        about: c.about,
        sectionTitle: c.sectionTitle,
        sectionText: c.sectionText,
        lightTitle: c.lightTitle,
        light: c.light,
        specs: [
          c.specs.status,
          [c.specs.type, c.kinds[project.kind] ?? project.kind],
          c.specs.scale,
          c.specs.timeline,
          c.specs.engineering,
          c.specs.brands,
          c.specs.services,
        ] as [string, string][],
      }
    : project;
  const kind = (localized && project.lt?.kind) || (c.kinds[project.kind] ?? project.kind);
  const name = (localized && project.lt?.name) || project.name;

  return (
    <>
      {/* Hero */}
      <section className="relative w-full" data-cursor={c.scroll} data-cursor-size="lg">
        <Photo src={photo.hero} className="flex min-h-[100svh] w-full flex-col">
          <div className="absolute inset-0 bg-black/30" />
          <SiteHeader variant="overlay" />
          <div className="relative mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-[78px] pb-10 pt-[116px]">
            <div className="px-4 md:px-10">
              <BackLink href="/projects">{c.back}</BackLink>
            </div>
            <div className="flex flex-col items-center gap-8 px-4 text-center text-white">
              <h1 className="max-w-[450px] text-[44px] font-medium leading-none tracking-[-0.04em] md:text-[64px]">{name}</h1>
              <p className="text-[15px] leading-[1.4] tracking-[-0.04em]">{kind}</p>
            </div>
          </div>
        </Photo>
      </section>

      {/* About the project */}
      <section className="w-full bg-cream px-4 py-[120px] md:px-10">
        <div className="mx-auto flex w-full max-w-[1360px] flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
          <p className="text-[18px] leading-[1.3] tracking-[-0.04em] text-secondary">{c.aboutEyebrow}</p>
          <div className="flex flex-col gap-8 lg:w-[640px]">
            <h2 className="text-[36px] font-medium leading-none tracking-[-0.04em] text-[#1f1f1f] md:text-[46px]">{copy.aboutTitle}</h2>
            <div className="flex flex-col gap-6 text-[18px] leading-[1.3] tracking-[-0.04em] text-label">
              {copy.about.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Horizontal image strip (Figma "images") */}
      <ImageStrip images={photo.strip} />

      {/* Details + specifications */}
      <section className="w-full bg-cream px-4 py-[120px] md:px-10">
        <div className="mx-auto flex w-full max-w-[1360px] flex-col gap-12 lg:flex-row lg:items-end lg:justify-between">
          <Photo src={photo.detail} className="h-[293px] w-full max-w-[432px]" />
          <div className="flex flex-col gap-12 lg:w-[640px]">
            {(copy.sectionTitle || copy.sectionText) && (
              <div className="flex max-w-[606px] flex-col gap-6">
                {copy.sectionTitle && <h2 className="text-[36px] font-medium leading-none tracking-[-0.04em] text-ink md:text-[46px]">{copy.sectionTitle}</h2>}
                {copy.sectionText && <p className="text-[18px] leading-[1.3] tracking-[-0.04em] text-label">{copy.sectionText}</p>}
              </div>
            )}
            <dl className="flex flex-col gap-4 text-[14px]">
              {copy.specs.map(([k, v]) => (
                <div key={k} className="flex gap-8 border-b border-[#d3d3d3] pb-4">
                  <dt className="flex-1 font-semibold leading-none tracking-[-0.03em] text-[#57595b]">{k}</dt>
                  <dd className="flex-1 leading-[1.3] tracking-[-0.04em] text-label">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* Full screen image (Figma 4217:47593) */}
      {photo.wide && <Photo src={photo.wide} position="center 65%" className="h-[360px] w-full sm:h-[420px] md:h-[480px] xl:aspect-[1440/550] xl:h-auto xl:min-h-[480px]" />}

      {/* 5 section (Figma 4217:47594): text + photo — only when there is a lighting story */}
      {(copy.lightTitle || copy.light.length > 0) && <section className="w-full bg-cream px-4 py-[120px] md:px-10">
        <div className="mx-auto flex w-full max-w-[1360px] flex-col gap-12 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-6 lg:w-[606px]">
            <h2 className="text-[36px] font-medium leading-none tracking-[-0.04em] text-ink md:text-[46px]">{copy.lightTitle}</h2>
            <div className="flex flex-col gap-6 text-[18px] leading-[1.3] tracking-[-0.04em] text-label">
              {copy.light.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </div>
          {photo.light && <Photo src={photo.light} className="aspect-[687/480] w-full lg:w-[687px] lg:shrink-0" />}
        </div>
      </section>}

      {/* Full screen image (Figma 4217:47599) */}
      {photo.end && <Photo src={photo.end} className="h-[380px] w-full sm:h-[460px] md:h-[540px] xl:aspect-[1440/640] xl:h-auto xl:min-h-[540px]" />}

      <LetsTalk />
    </>
  );
}
