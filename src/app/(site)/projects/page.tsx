import type { Metadata } from "next";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { SiteHeader } from "@/components/site/Header";
import { Photo } from "@/components/ui/Photo";
import { ArrowIcon } from "@/components/ui/Icons";
import { PROJECTS, type Project, type ProjectType } from "@/data/projects";

export const metadata: Metadata = {
  title: "Projects — Simetria LT",
  description: "Selected furnishing and lighting projects by Simetria.",
};

const TABS: { label: string; value: ProjectType | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Private", value: "private" },
  { label: "Public", value: "public" },
  { label: "Other", value: "other" },
];

// Row layouts from the Figma grid: "wide" cards flex to fill, others are 360px; "tall" images are 752px.
type Slot = { wide: boolean; tall: boolean };
const ROW_PATTERNS: Slot[][] = [
  [{ wide: true, tall: true }, { wide: false, tall: false }, { wide: false, tall: false }],
  [{ wide: false, tall: false }, { wide: true, tall: false }, { wide: false, tall: false }],
  [{ wide: false, tall: false }, { wide: true, tall: true }],
];

function buildRows(projects: Project[]): { project: Project; slot: Slot }[][] {
  const rows: { project: Project; slot: Slot }[][] = [];
  let i = 0;
  let p = 0;
  while (i < projects.length) {
    const pattern = ROW_PATTERNS[p % ROW_PATTERNS.length];
    const row = pattern
      .slice(0, projects.length - i)
      .map((slot, j) => ({ project: projects[i + j], slot }));
    // A single leftover card should stretch rather than sit at 360px.
    if (row.length === 1) row[0].slot = { wide: true, tall: false };
    rows.push(row);
    i += row.length;
    p++;
  }
  return rows;
}

function ProjectCard({ project, slot }: { project: Project; slot: Slot }) {
  return (
    <Link
      href={`/contact?product=${encodeURIComponent(project.name)}`}
      className={cn("group flex flex-col gap-4", slot.wide ? "w-full lg:flex-1" : "w-full lg:w-[360px] lg:shrink-0")}
    >
      <Photo
        src={project.image}
        className={cn("w-full overflow-hidden", slot.tall ? "h-[420px] lg:h-[752px]" : "h-[420px] lg:h-[458px]")}
      >
        <span className="absolute left-1/2 top-1/2 flex size-[100px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/20 text-center text-[14px] leading-[1.3] tracking-[-0.04em] text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">
          View project
        </span>
      </Photo>
      <div className="flex flex-col gap-2 font-medium leading-none">
        <p className="text-[18px] tracking-[-0.04em] text-black">{project.name}</p>
        <p className="text-[13px] uppercase tracking-[-0.04em] text-body">{project.category}</p>
      </div>
    </Link>
  );
}

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type } = await searchParams;
  const active = TABS.some((t) => t.value === type) ? (type as ProjectType | "all") : "all";
  const projects = active === "all" ? PROJECTS : PROJECTS.filter((p) => p.type === active);
  const rows = buildRows(projects);

  return (
    <div className="flex w-full flex-col gap-[120px] bg-cream">
      <div className="flex w-full flex-col gap-14">
        {/* Hero (Figma node 4217:46224) */}
        <section className="flex w-full flex-col gap-16 lg:gap-[100px]">
          <SiteHeader variant="solid" />
          <div className="mx-auto w-full max-w-[1440px] px-4 md:px-10">
            <h1 className="max-w-[700px] text-[56px] font-medium leading-[0.92] tracking-[-0.04em] text-black md:text-[80px] xl:text-[106px]">
              Our projects
            </h1>
          </div>
        </section>

        <section className="mx-auto flex w-full max-w-[1440px] flex-col gap-8 px-4 md:px-10">
          {/* Tabs + link (Figma node 4217:46230) */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              {TABS.map((tab) => {
                const isActive = tab.value === active;
                return (
                  <Link
                    key={tab.value}
                    href={tab.value === "all" ? "/projects" : `/projects?type=${tab.value}`}
                    className={cn(
                      "flex h-[34px] items-center gap-3 rounded-[2px] px-[18px] text-[14px] font-semibold leading-none tracking-[-0.03em] transition-colors",
                      isActive ? "bg-dark text-white" : "border border-line text-tertiary hover:text-ink"
                    )}
                  >
                    <span className={cn("size-[5px]", isActive ? "bg-white" : "bg-tertiary")} />
                    {tab.label}
                  </Link>
                );
              })}
            </div>
            <Link
              href="/catalogue"
              className="flex h-[27px] items-center gap-2 border-b border-black pb-1.5 text-[18px] font-medium leading-none tracking-[-0.04em] text-black hover:text-accent hover:border-accent"
            >
              View products
              <ArrowIcon className="size-5" />
            </Link>
          </div>

          {/* Grid (Figma node 4217:46237) */}
          <div className="flex flex-col gap-10">
            {rows.map((row, i) => (
              <div key={i} className="flex flex-col gap-4 lg:flex-row lg:items-start">
                {row.map(({ project, slot }) => (
                  <ProjectCard key={project.slug} project={project} slot={slot} />
                ))}
              </div>
            ))}
            {projects.length === 0 && <p className="text-secondary">No projects in this category yet.</p>}
          </div>
        </section>
      </div>
    </div>
  );
}
