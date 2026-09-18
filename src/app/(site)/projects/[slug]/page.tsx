import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site/Header";
import { Photo } from "@/components/ui/Photo";
import { BackLink } from "@/components/ui/Button";
import { LetsTalk } from "@/components/site/Sections";
import { PROJECTS, getProject } from "@/data/projects";

export function generateStaticParams() {
  return PROJECTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const project = getProject(slug);
  return { title: project ? `${project.name} — Simetria LT` : "Project — Simetria LT" };
}

function ScrollCircle({ className }: { className?: string }) {
  return (
    <span
      className={`flex size-[150px] items-center justify-center rounded-full bg-white/20 text-center text-[18px] leading-[1.3] tracking-[-0.04em] text-white backdrop-blur-sm ${className ?? ""}`}
    >
      Scroll to view
    </span>
  );
}

// Figma "Case page / ver 2" (node 4217:47517)
export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) notFound();
  const img = (n: string) => `/images/projects/${project.slug}/${n}.jpg`;

  return (
    <>
      {/* Hero */}
      <section className="relative w-full">
        <Photo src={img("hero")} className="w-full">
          <div className="absolute inset-0 bg-black/30" />
          <SiteHeader variant="overlay" />
          <div className="relative mx-auto flex min-h-[640px] max-w-[1440px] flex-col gap-[78px] pt-[116px] lg:min-h-[800px]">
            <div className="px-4 md:px-10">
              <BackLink href="/projects">Back to Projects</BackLink>
            </div>
            <div className="flex flex-col items-center gap-8 px-4 text-center text-white">
              <h1 className="max-w-[450px] text-[44px] font-medium leading-none tracking-[-0.04em] md:text-[64px]">{project.name}</h1>
              <p className="text-[15px] leading-[1.4] tracking-[-0.04em]">{project.kind}</p>
            </div>
            <ScrollCircle className="absolute right-[265px] top-[538px] hidden xl:flex" />
          </div>
        </Photo>
      </section>

      {/* About the project */}
      <section className="w-full bg-cream px-4 py-[120px] md:px-10">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
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

      {/* Horizontal image strip */}
      <section className="relative w-full overflow-x-auto">
        <div className="flex h-[420px] w-max gap-2 lg:h-[700px]">
          {["1", "2", "3"].map((n) => (
            <Photo key={n} src={img(n)} className="h-full w-[420px] lg:w-[674px]" />
          ))}
        </div>
        <ScrollCircle className="pointer-events-none absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 xl:flex" />
      </section>

      {/* Details + specifications */}
      <section className="w-full bg-cream px-4 py-[120px] md:px-10">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-12 lg:flex-row lg:items-end lg:justify-between">
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

      {/* Image grid */}
      <section className="mx-auto flex w-full max-w-[1440px] flex-col gap-[10px] px-4 md:px-10">
        <Photo src={img("5")} className="h-[420px] w-full lg:h-[750px]" />
        <div className="flex flex-col gap-2 md:flex-row">
          <Photo src={img("6")} className="h-[420px] w-full md:flex-1 lg:h-[750px]" />
          <Photo src={img("7")} className="h-[420px] w-full md:flex-1 lg:h-[750px]" />
        </div>
      </section>

      <LetsTalk />
    </>
  );
}
