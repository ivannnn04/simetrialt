import Link from "next/link";
import { cn } from "@/lib/cn";
import { DotButton, StrokeLink } from "@/components/ui/Button";
import { Photo } from "@/components/ui/Photo";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";

// ---------- Services list (Figma "services", node 4188:22369) ----------

export const SERVICES = [
  {
    number: "01",
    slug: "lighting",
    tags: ["Light calculation", "Custom fixtures", "Integration & support"],
    title: "Lighting design & solutions",
    text: "Lighting project development, calculations and compliance, smart lighting integration and custom fixtures, from concept through to handover. We ensure your design vision is fully realized by maintaining seamless coordination throughout every project phase.",
    image: "/images/services/lighting.jpg",
  },
  {
    number: "02",
    slug: "smart-home",
    tags: ["Smart lighting", "Climate control", "AV & security"],
    title: "Smart home systems",
    text: "Smart lighting, automated window coverings, security, climate control, and audio/video systems — fully designed, integrated, and implemented from concept to final commissioning, tailored to ensure seamless operation, comfort, security, and intuitive control.",
    image: "/images/services/smart-home.jpg",
  },
  {
    number: "03",
    slug: "bespoke",
    tags: ["Custom furniture", "Bespoke finishes", "Material sourcing"],
    title: "Bespoke interior solutions",
    text: "Custom furniture design and manufacturing, bespoke doors, flooring design and manufacturing, and stone finishing solutions.",
    image: "/images/services/bespoke.jpg",
  },
  {
    number: "04",
    slug: "installation",
    tags: ["Installation", "Commissioning", "Ongoing support"],
    title: "Installation & after-sales support",
    text: "Full on-site implementation, including installation, configuration, testing, and final commissioning, with ongoing technical support, maintenance, and service long after the project has been handed over.",
    image: "/images/services/installation.jpg",
  },
];

/**
 * Stacking geometry (home page, lg+). Cards pin STACK_START px below the viewport top; each next
 * card slides over the previous one and pins STACK_STEP px lower, so only the header strip
 * (number, tags, title, image edge) of covered cards stays visible. The last card is not sticky:
 * pinned cards get a min-height chosen so they all release exactly when the last card reaches its
 * slot, after which the assembled stack scrolls away as one block.
 */
const STACK_START = 100;
const STACK_STEP = 200;
const CARD_HEIGHT = 500;

type ServicesListProps = {
  className?: string;
  /**
   * Home page (Figma 4217:47687): cards are sticky and each next card slides over the
   * previous one while scrolling, leaving only its header row visible.
   */
  stack?: boolean;
};

export function ServicesList({ className, stack = false }: ServicesListProps) {
  const last = SERVICES.length - 1;
  const lastSlot = STACK_START + last * STACK_STEP;
  return (
    <section id="services" className={cn("w-full bg-cream pb-[120px]", className)}>
      <div>
        {SERVICES.map((s, i) => {
          const pinned = stack && i < last;
          const top = STACK_START + i * STACK_STEP;
          const style = pinned
            ? ({ "--stack-top": `${top}px`, "--stack-h": `${lastSlot + CARD_HEIGHT - top}px`, zIndex: i + 1 } as React.CSSProperties)
            : stack
              ? { zIndex: i + 1 }
              : undefined;
          return (
        <article
          key={s.number}
          className={cn("border-t border-line bg-cream py-[50px]", stack && "relative lg:min-h-[500px]", pinned && "services-card")}
          style={style}
        >
          <div
            className={cn(
              "mx-auto flex max-w-[1440px] flex-col gap-8 px-4 md:px-10 lg:flex-row",
              stack ? "lg:items-start" : "lg:items-center"
            )}
          >
            <div className="flex w-full items-start justify-between gap-6 lg:w-[738px] lg:shrink-0">
              <p className="text-[18px] leading-[1.3] tracking-[-0.04em] text-secondary">/ {s.number}</p>
              <div className="flex w-full flex-col gap-8 lg:w-[669px]">
                <div className="flex flex-col gap-6">
                  <ul className="flex flex-wrap gap-[10px]">
                    {s.tags.map((tag) => (
                      <li
                        key={tag}
                        className="rounded-full border border-line px-4 py-2 text-[14px] font-medium leading-[1.3] tracking-[-0.04em] text-label"
                      >
                        {tag}
                      </li>
                    ))}
                  </ul>
                  <h2 className="text-[36px] font-medium leading-[1.1] tracking-[-0.04em] text-ink md:text-[52px]">
                    {s.title}
                  </h2>
                </div>
                <div className="flex flex-col gap-8">
                  <p className="max-w-[562px] text-[16px] leading-[1.3] tracking-[-0.04em] text-label">{s.text}</p>
                  <div>
                    <DotButton href={`/services/${s.slug}`}>Read more</DotButton>
                  </div>
                </div>
              </div>
            </div>
            <Photo src={s.image} tone="light" className="h-[280px] w-full lg:h-[400px] lg:flex-1" />
          </div>
        </article>
          );
        })}
      </div>
    </section>
  );
}

// ---------- Projects showcase (Figma "projects", node 4129:25960) ----------

const PROJECT_INFO = [
  ["Location", "Germany"],
  ["Duration", "22 month"],
  ["Year", "2026"],
  ["Rooms", "140"],
];

export function ProjectsSection() {
  return (
    <section id="projects" className="relative w-full">
      <Photo src="/images/projects/prusta.jpg" className="w-full">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0)_0%,rgba(0,0,0,0.5)_100%)]" />
        <div className="relative mx-auto flex max-w-[1440px] items-end justify-between">
          <div className="flex min-h-[800px] w-full flex-col justify-between bg-cream/10 px-4 pb-10 pt-[200px] backdrop-blur-[7.5px] md:px-10 lg:w-[576px]">
            <div className="flex flex-col gap-6 text-white">
              <div className="flex max-w-[478px] flex-col gap-4">
                <p className="text-[18px] font-semibold leading-none tracking-[-0.04em]">/ Apartment</p>
                <h2 className="max-w-[490px] text-[56px] font-medium leading-[0.9] tracking-[-0.04em] md:text-[80px]">
                  PRUSTA Jogailos butas
                </h2>
                <p className="text-[16px] leading-[1.3] tracking-[-0.04em]">
                  Lighting project development, calculations and compliance, smart lighting integration and custom
                  fixtures, from concept through to handover.
                </p>
              </div>
              <div>
                <DotButton variant="primary" href="/catalogue">Explore products</DotButton>
              </div>
            </div>
            <dl className="mt-16 flex w-full max-w-[330px] flex-col gap-1.5 text-[14px] leading-none tracking-[-0.04em] text-tertiary">
              {PROJECT_INFO.map(([k, v]) => (
                <div key={k} className="flex items-center justify-between border-b border-white/30 py-1.5">
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="hidden pb-10 pr-10 lg:flex">
            <div className="flex flex-col gap-2">
              <span className="h-[38px] w-2 rounded-[10px] bg-white" />
              <span className="size-2 rounded-[10px] bg-cream/40" />
              <span className="size-2 rounded-[10px] bg-cream/40" />
            </div>
          </div>
        </div>
      </Photo>
    </section>
  );
}

// ---------- "Let's talk" CTA (Figma node 4048:29445) ----------

export function LetsTalk() {
  return (
    <section className="w-full overflow-hidden bg-cream py-[120px] md:py-[244px]">
      <Link
        href="/contact"
        className="flex items-center justify-center gap-[0.23em] whitespace-nowrap text-[clamp(64px,16.8vw,242px)] font-bold uppercase leading-none tracking-[-0.04em] text-warm-overlay/60 transition-colors hover:text-warm-overlay"
      >
        <span>Let’s</span>
        <span>Talk</span>
      </Link>
    </section>
  );
}

// ---------- Small helpers ----------

export function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn("text-[16px] font-semibold uppercase leading-none tracking-[-0.04em]", className)}>{children}</p>
  );
}

// ---------- CTA section (Figma "CTA section", node 4075:23492) ----------

type CtaProps = {
  eyebrow: string;
  image: string;
  title: string;
  text: string;
  button: { label: string; href: string };
};

export function CtaSection({ eyebrow, image, title, text, button }: CtaProps) {
  return (
    <section className="w-full bg-cream px-4 py-[120px] md:px-10">
      <div className="mx-auto flex max-w-[1440px] flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-10">
          <p className="text-center text-[18px] font-medium leading-none tracking-[-0.04em] text-dark">{eyebrow}</p>
          <Photo src={image} className="h-[134px] w-[169px] rounded-[2px]" />
        </div>
        <div className="flex w-full flex-col items-center gap-8">
          <div className="flex flex-col items-center gap-4 pb-[11px] text-center">
            <h2 className="max-w-[880px] text-[40px] font-medium leading-none tracking-[-0.04em] text-ink md:text-[64px]">
              {title}
            </h2>
            <p className="text-[14px] leading-[1.3] tracking-[-0.04em] text-secondary">{text}</p>
          </div>
          <DotButton href={button.href}>{button.label}</DotButton>
        </div>
      </div>
    </section>
  );
}

// ---------- Underlined arrow link (Figma "button stroke") ----------

export const SectionLink = StrokeLink;

// ---------- Page hero: breadcrumbs + display title + side copy (Figma "hero section") ----------

type PageHeroProps = {
  crumbs?: { label: string; href?: string }[];
  title: React.ReactNode;
  text?: string;
  button?: { label: string; href: string };
  titleClassName?: string;
  children?: React.ReactNode;
};

export function PageHero({ crumbs, title, text, button, titleClassName, children }: PageHeroProps) {
  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-10 px-4 md:px-10 lg:flex-row lg:items-end">
      <div className="flex flex-1 flex-col gap-6">
        {crumbs && <Breadcrumbs items={crumbs} />}
        <h1
          className={cn(
            "text-[56px] font-medium leading-[0.92] tracking-[-0.04em] text-black md:text-[80px] xl:text-[105px]",
            titleClassName
          )}
        >
          {title}
        </h1>
        {children}
      </div>
      {(text || button) && (
        <div className="flex flex-col gap-6 lg:w-[382px] lg:shrink-0">
          {text && <p className="text-[16px] leading-[1.3] tracking-[-0.04em] text-body">{text}</p>}
          {button && (
            <div>
              <DotButton href={button.href}>{button.label}</DotButton>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
