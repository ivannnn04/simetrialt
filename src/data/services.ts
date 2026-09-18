/** Content for the individual service pages (Figma "Services page: lighting", node 4217:46064). */

export type ServiceStage = { label: string; text: string };

export type ServicePage = {
  slug: string;
  title: string;
  /** Title split into two lines for the hero (Figma sets a manual break). */
  titleLines: [string, string];
  breadcrumb: string;
  intro: string;
  heroImage: string;
  overview: {
    heading: string;
    text: string;
    points: string[];
    image: string;
    imageSmall: string;
  };
  stages: ServiceStage[];
  stagesImage: string;
  recentWork: {
    eyebrow: string;
    heading: string;
    cards: { category: string; title: string; tag: string; image: string; href: string }[];
  };
};

const SERVICE_PAGES: ServicePage[] = [
  {
    slug: "lighting",
    title: "Lighting design & solutions",
    titleLines: ["Lighting design", "& solutions"],
    breadcrumb: "Lighting Design & Solutions",
    intro:
      "We specialize in lighting development, calculations, and custom fixtures. From concept to handover, we manage every detail to realize your vision.",
    heroImage: "/images/services/lighting/hero.jpg",
    overview: {
      heading: "Lighting project development",
      text: "We develop lighting schemes from concept to tender-ready specification — working alongside the architect's team to translate spatial intent into a technically sound, budget-aware lighting brief.",
      points: [
        "Concept development and mood studies",
        "Luminaire schedule and specification",
        "Photometric layout (DIALux / Relux)",
        "Tender documentation and BOQ",
      ],
      image: "/images/services/lighting/overview.jpg",
      imageSmall: "/images/services/lighting/overview-small.jpg",
    },
    stages: [
      { label: "Book a consultation", text: "We read the space — ceiling heights, daylight, materials, programme — before writing a single lux value" },
      { label: "Concept & scheme design", text: "Mood studies, layering strategy and first luminaire families, agreed with the architect before detailing" },
      { label: "Technical specification", text: "Photometric calculations, luminaire schedule, control zoning and compliance checks" },
      { label: "Procurement & supply", text: "Orders placed with the manufacturers we represent, lead times aligned with the site programme" },
      { label: "Installation & sign-off", text: "On-site supervision, aiming and commissioning, then a final walkthrough with the client" },
    ],
    stagesImage: "/images/services/lighting/stages.jpg",
    recentWork: {
      eyebrow: "RECENT LIGHTING WORK",
      heading: "Projects where we led the lighting brief",
      cards: [
        { category: "RESIDENTIAL · CUSTOM FIXTURES", title: "Baltic Innovation HQ", tag: "NEW PROJECT", image: "/images/projects/baltic-innovation-hq/cover.jpg", href: "/projects/baltic-innovation-hq" },
        { category: "RESIDENTIAL · CUSTOM FIXTURES", title: "Baltic Residence", tag: "NEW PROJECT", image: "/images/projects/seaside-residence/cover.jpg", href: "/projects/seaside-residence" },
      ],
    },
  },
  {
    slug: "smart-home",
    title: "Smart home systems",
    titleLines: ["Smart home", "systems"],
    breadcrumb: "Smart Home Systems",
    intro:
      "Lighting, shading, climate, security and audio-video — designed as one system, integrated and commissioned so the home is simple to live with.",
    heroImage: "/images/services/smart-home/hero.jpg",
    overview: {
      heading: "Integrated home automation",
      text: "We design the control architecture early, so cabling, device positions and interfaces are coordinated with the interior rather than added afterwards.",
      points: [
        "Control strategy and zoning",
        "Lighting, shading and climate integration",
        "Security, access and AV systems",
        "Programming and commissioning",
      ],
      image: "/images/services/smart-home/overview.jpg",
      imageSmall: "/images/services/smart-home/overview-small.jpg",
    },
    stages: [
      { label: "Book a consultation", text: "We map how the household actually uses each room before choosing a platform" },
      { label: "System design", text: "Device schedule, network topology and interface layout, coordinated with the electrical design" },
      { label: "Technical specification", text: "Wiring diagrams, rack layouts and a full bill of materials for tender" },
      { label: "Procurement & supply", text: "Equipment sourced from certified partners with lead times matched to the fit-out" },
      { label: "Commissioning & training", text: "Scenes and schedules programmed on site, followed by a handover session for the owners" },
    ],
    stagesImage: "/images/services/smart-home/stages.jpg",
    recentWork: {
      eyebrow: "RECENT SMART HOME WORK",
      heading: "Homes where every system speaks one language",
      cards: [
        { category: "RESIDENTIAL · SMART HOME", title: "Seaside Residence", tag: "NEW PROJECT", image: "/images/projects/seaside-residence/cover.jpg", href: "/projects/seaside-residence" },
        { category: "RESIDENTIAL · LIGHTING DESIGN", title: "PRUSTA Jogailos butas", tag: "NEW PROJECT", image: "/images/projects/prusta-jogailos/cover.jpg", href: "/projects/prusta-jogailos" },
      ],
    },
  },
  {
    slug: "bespoke",
    title: "Bespoke interior solutions",
    titleLines: ["Bespoke interior", "solutions"],
    breadcrumb: "Bespoke Interior Solutions",
    intro:
      "Custom furniture, doors, flooring and stone finishes — designed to the drawing and manufactured by workshops we have worked with for years.",
    heroImage: "/images/services/bespoke/hero.jpg",
    overview: {
      heading: "Made to the drawing",
      text: "We take the architect's detail and turn it into shop drawings, samples and a manufacturing programme, keeping one point of responsibility from prototype to installation.",
      points: [
        "Custom furniture design and prototyping",
        "Bespoke doors and joinery",
        "Flooring design and manufacturing",
        "Stone and surface finishing",
      ],
      image: "/images/services/bespoke/overview.jpg",
      imageSmall: "/images/services/bespoke/overview-small.jpg",
    },
    stages: [
      { label: "Book a consultation", text: "We review the design intent, materials and budget together with the architect" },
      { label: "Shop drawings", text: "Every piece detailed for production and signed off before manufacturing starts" },
      { label: "Samples & prototypes", text: "Finishes, veneers and hardware approved on physical samples, not renders" },
      { label: "Manufacturing", text: "Production tracked weekly in the workshops, with quality checks before dispatch" },
      { label: "Installation & sign-off", text: "Delivered and fitted by our own team, then walked through with the client" },
    ],
    stagesImage: "/images/services/bespoke/stages.jpg",
    recentWork: {
      eyebrow: "RECENT BESPOKE WORK",
      heading: "Interiors built piece by piece",
      cards: [
        { category: "RESIDENTIAL · BESPOKE INTERIOR", title: "Vilnius Loft Kitchen", tag: "NEW PROJECT", image: "/images/projects/vilnius-loft-kitchen/cover.jpg", href: "/projects/vilnius-loft-kitchen" },
        { category: "HOSPITALITY · FURNITURE", title: "Hotel Vilnia", tag: "NEW PROJECT", image: "/images/projects/hotel-vilnia/cover.jpg", href: "/projects/hotel-vilnia" },
      ],
    },
  },
  {
    slug: "installation",
    title: "Installation & after-sales support",
    titleLines: ["Installation &", "after-sales support"],
    breadcrumb: "Installation & After-Sales Support",
    intro:
      "Full on-site implementation — installation, configuration, testing and commissioning — with technical support that continues long after handover.",
    heroImage: "/images/services/installation/hero.jpg",
    overview: {
      heading: "On site until it works",
      text: "Our installers work from the same drawings as the specifiers, so what was designed is what gets fitted. After handover we stay reachable for maintenance, spares and adjustments.",
      points: [
        "Delivery coordination and site logistics",
        "Installation and configuration",
        "Testing and commissioning",
        "Maintenance and long-term support",
      ],
      image: "/images/services/installation/overview.jpg",
      imageSmall: "/images/services/installation/overview-small.jpg",
    },
    stages: [
      { label: "Book a consultation", text: "We agree the installation scope, access and sequencing with the main contractor" },
      { label: "Site survey", text: "Dimensions, services and finishes verified on site before anything is delivered" },
      { label: "Delivery & logistics", text: "Deliveries scheduled to the construction programme and stored safely on site" },
      { label: "Installation & testing", text: "Fitted, connected and tested by our own team, snagging closed before sign-off" },
      { label: "After-sales support", text: "Maintenance visits, spare parts and adjustments for as long as the space is in use" },
    ],
    stagesImage: "/images/services/installation/stages.jpg",
    recentWork: {
      eyebrow: "RECENT INSTALLATION WORK",
      heading: "Projects delivered end to end",
      cards: [
        { category: "OFFICE · LIGHTING DESIGN", title: "Modern Workspace", tag: "NEW PROJECT", image: "/images/projects/modern-workspace/cover.jpg", href: "/projects/modern-workspace" },
        { category: "HOSPITALITY · CUSTOM FIXTURES", title: "Riverside Restaurant", tag: "NEW PROJECT", image: "/images/projects/riverside-restaurant/cover.jpg", href: "/projects/riverside-restaurant" },
      ],
    },
  },
];

export const SERVICE_SLUGS = SERVICE_PAGES.map((s) => s.slug);

export function getServicePage(slug: string): ServicePage | undefined {
  return SERVICE_PAGES.find((s) => s.slug === slug);
}
