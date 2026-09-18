import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site/Header";
import { Photo } from "@/components/ui/Photo";
import { BackLink } from "@/components/ui/Button";
import { LetsTalk } from "@/components/site/Sections";
import { ImageStrip } from "@/components/projects/ImageStrip";
import { PROJECTS, getProject } from "@/data/projects";

export function generateStaticParams() {
  return PROJECTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const project = getProject(slug);
  return { title: project ? `${project.name} — Simetria LT` : "Project — Simetria LT" };
}

// Figma "Case page / ver 2 / upd 06.08" (node 4217:47559)
export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) notFound();
  const img = (n: string) => `/images/projects/${project.slug}/${n}.jpg`;

  return (
    <>
      {/* Hero */}
      <section className="relative w-full" data-cursor="Scroll to view" data-cursor-size="lg">
        <Photo src={img("hero")} className="flex min-h-[100svh] w-full flex-col">
          <div className="absolute inset-0 bg-black/30" />
          <SiteHeader variant="overlay" />
          <div className="relative mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-[78px] pb-10 pt-[116px]">
            <div className="px-4 md:px-10">
              <BackLink href="/projects">Back to Projects</BackLink>
            </div>
            <div className="flex flex-col items-center gap-8 px-4 text-center text-white">
              <h1 className="max-w-[450px] text-[44px] font-medium leading-none tracking-[-0.04em] md:text-[64px]">{project.name}</h1>
              <p className="text-[15px] leading-[1.4] tracking-[-0.04em]">{project.kind}</p>
            </div>
          </div>
        </Photo>
      </section>

      {/* About the project */}
      <section className="w-full bg-cream px-4 py-[120px] md:px-10">
        <div className="mx-auto flex w-full max-w-[1360px] flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
          <p className="text-[18px] leading-[1.3] tracking-[-0.04em] text-secondary">About the Project</p>
          <div className="flex flex-col gap-8 lg:w-[640px]">
            <h2 className="text-[36px] font-medium leading-none tracking-[-0.04em] text-[#1f1f1f] md:text-[46px]">{project.aboutTitle}</h2>
            <div className="flex flex-col gap-6 text-[18px] leading-[1.3] tracking-[-0.04em] text-label">
              {project.about.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Horizontal image strip (Figma "images") */}
      <ImageStrip images={["1", "2", "3", "4", "5", "6", "7"].map(img)} />

      {/* Details + specifications */}
      <section className="w-full bg-cream px-4 py-[120px] md:px-10">
        <div className="mx-auto flex w-full max-w-[1360px] flex-col gap-12 lg:flex-row lg:items-end lg:justify-between">
          <Photo src={img("4")} className="h-[293px] w-full max-w-[432px]" />
          <div className="flex flex-col gap-12 lg:w-[640px]">
            <div className="flex max-w-[606px] flex-col gap-6">
              <h2 className="text-[36px] font-medium leading-none tracking-[-0.04em] text-ink md:text-[46px]">{project.sectionTitle}</h2>
              <p className="text-[18px] leading-[1.3] tracking-[-0.04em] text-label">{project.sectionText}</p>
            </div>
            <dl className="flex flex-col gap-4 text-[14px]">
              {project.specs.map(([k, v]) => (
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
      <Photo src={img("5")} position="center 65%" className="aspect-[1440/550] w-full" />

      {/* 5 section (Figma 4217:47594): text + photo */}
      <section className="w-full bg-cream px-4 py-[120px] md:px-10">
        <div className="mx-auto flex w-full max-w-[1360px] flex-col gap-12 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-6 lg:w-[606px]">
            <h2 className="text-[36px] font-medium leading-none tracking-[-0.04em] text-ink md:text-[46px]">{project.lightTitle}</h2>
            <div className="flex flex-col gap-6 text-[18px] leading-[1.3] tracking-[-0.04em] text-label">
              {project.light.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </div>
          <Photo src={img("6")} className="aspect-[687/480] w-full lg:w-[687px] lg:shrink-0" />
        </div>
      </section>

      {/* Full screen image (Figma 4217:47599) */}
      <Photo src={img("7")} className="aspect-[1440/640] w-full" />

      <LetsTalk />
    </>
  );
}
