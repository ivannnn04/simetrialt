/** English copy (default locale). The Lithuanian dictionary must match this shape. */
export const en = {
  meta: {
    title: "Simetria LT",
    description: "Simetria — furniture and lighting solutions for architects who build at scale.",
  },
  nav: {
    products: "Products",
    services: "Services",
    projects: "Projects",
    brands: "Brands",
    outlet: "Outlet",
    about: "About",
    contacts: "Contacts",
    search: "Search",
    myAlbums: (n: number) => `My albums (${n})`,
    account: "Account",
    signIn: "Sign in",
    menu: "Menu",
    closeMenu: "Close menu",
    home: "Simetria home",
    category: "CATEGORY",
    language: "Language",
    cards: {
      icons: "Design Icons & Best-Selling Items",
      outlet: "Special Outlet Pricing & Archives",
    },
  },
  search: {
    placeholder: "Search",
    label: "Search products",
    results: "Search Results",
    empty: "No results were found for your query",
  },
  /** Category, typology and menu-group names shown in the header menu and on product cards. Keys are the English values. */
  terms: {} as Record<string, string>,
  home: {
    hero: {
      text: "For long-term projects with real volume — hotels, offices, residential developments — Simetria sources, specifies and delivers from a single point of accountability.",
      explore: "Explore products",
      book: "Book a consultation",
      badge: "Design house, established for architects",
      title: ["Furniture and lighting", "solutions for architects", "who build at scale"],
    },
    why: {
      badge: "Why architects work with us",
      title: "Everything architects need in a design partner",
      scroll: "Scroll",
    },
    features: [
      {
        title: "Long-term partnerships",
        text: "Trusted by architects and designers for reliable collaboration, thoughtful guidance, and consistent support across every stage of a project.",
      },
      {
        title: "Single point of accountability",
        text: "One partner sources, specifies, delivers and installs — so schedules, budgets and quality stay under control from concept to handover.",
      },
      {
        title: "Curated brands, honest advice",
        text: "We represent manufacturers we trust and recommend only what fits the project — never what happens to be in stock.",
      },
    ],
    productLine: { title: "Our product line", cta: "Catalog" },
    brands: "BRANDS WE REPRESENT",
    projects: {
      cta: "Explore products",
      slides: [
        {
          category: "Apartment",
          title: "PRUSTA Jogailos butas",
          text: "Lighting project development, calculations and compliance, smart lighting integration and custom fixtures, from concept through to handover.",
          info: [
            ["Location", "Vilnius"],
            ["Duration", "22 month"],
            ["Year", "2026"],
            ["Rooms", "140"],
          ] as [string, string][],
        },
        {
          category: "Hotel",
          title: "Grand Hotel Kempinski suites",
          text: "Full furniture and lighting specification for 120 suites, sourced from six brands and delivered in three phases without a single day of downtime.",
          info: [
            ["Location", "Vilnius"],
            ["Duration", "14 month"],
            ["Year", "2025"],
            ["Rooms", "120"],
          ] as [string, string][],
        },
        {
          category: "Office",
          title: "Quadrum business centre",
          text: "Workplace furniture, acoustic solutions and a custom lighting scheme for 4,000 m² of open-plan and meeting space, installed over one summer.",
          info: [
            ["Location", "Vilnius"],
            ["Duration", "9 month"],
            ["Year", "2024"],
            ["Area", "4 000 m²"],
          ] as [string, string][],
        },
      ],
    },
    about: {
      title: "Furniture Solutions Without Complexity",
      button: "About Us",
      text: "Simetria is a premium design showroom and project partner, delivering curated furniture and lighting solutions through expert sourcing, specification, procurement, and seamless project execution.",
      numbers: ["Rooms", "Projects", "Brands"],
    },
  },
  services: {
    readMore: "Read more",
    items: {
      lighting: {
        tags: ["Light calculation", "Custom fixtures", "Integration & support"],
        title: "Lighting design & solutions",
        text: "Lighting project development, calculations and compliance, smart lighting integration and custom fixtures, from concept through to handover. We ensure your design vision is fully realized by maintaining seamless coordination throughout every project phase.",
      },
      "smart-home": {
        tags: ["Smart lighting", "Climate control", "AV & security"],
        title: "Smart home systems",
        text: "Smart lighting, automated shading, security, climate and AV systems — fully designed, integrated and commissioned from concept to final handover, tuned for seamless operation, comfort, security and intuitive control.",
      },
      bespoke: {
        tags: ["Custom furniture", "Bespoke finishes", "Material sourcing"],
        title: "Bespoke interior solutions",
        text: "Custom-designed furniture design and manufacturing, made-to-order doors, flooring design and production, and stone finish solutions.",
      },
      installation: {
        tags: ["Installation", "Commissioning", "Ongoing support"],
        title: "Installation & after-sales support",
        text: "Comprehensive on-site delivery including installation, configuration, testing and final commissioning, plus ongoing technical support, maintenance and service long after the project is handed over.",
      },
    } as Record<string, { tags: string[]; title: string; text: string; points?: string[]; cta?: string }>,
  },
  servicesPage: {
    meta: { title: "Services — Simetria LT", description: "Professional interior solutions: lighting design, smart home systems, bespoke interiors, installation." },
    hero: {
      title: ["Professional", "interior solutions"],
      text: "Bridging the gap between design vision and technical reality through expert sourcing, precise specification, and project-wide accountability.",
      button: "Book a consultation",
    },
    process: [
      {
        title: "Consultation & Project Discovery",
        text: "We meet on site or in the showroom, study the brief and drawings, and agree on scope, budget and timeline before anything is specified.",
      },
      {
        title: "Selection & Proposal",
        text: "Our team shortlists furniture and lighting from the brands we represent, prepares samples and a priced proposal with lead times.",
      },
      {
        title: "Order & Coordination",
        text: "We place and track every order, align deliveries with the construction schedule and keep one point of contact for the whole project.",
      },
      {
        title: "Delivery & Project Completion",
        text: "Installation, commissioning and a final walkthrough, followed by after-sales support for as long as the space is in use.",
      },
    ],
    cta: {
      eyebrow: "Check out our projects",
      title: "A dedicated design partner for full-cycle lighting development and interior solutions.",
      text: "Calculations, compliance, smart integration, and custom fixtures.",
      button: "Scroll",
    },
  },
  /** Per-service page overrides; English content lives in src/data/services.ts. */
  servicePages: {} as Record<string, { overview?: { heading: string; text: string; points: string[] } }>,
  letsTalk: ["Let’s", "Talk"] as string[],
  footer: {
    title: "Your End-to-End Furnishing Partner",
    text: "We source, specify, deliver, and coordinate every stage of your furnishing project.",
    cta: "Get in touch",
    columns: { products: "Products", services: "Services", company: "Company", social: "Social media" },
    products: { furniture: "Furniture", lighting: "Lighting", decor: "Decor (Accessories)", outlet: "Outlet" },
    services: {
      lighting: "Lighting design & solutions",
      smartHome: "Smart home systems",
      bespoke: "Bespoke interior solutions",
      installation: "Installation & after-sales support",
    },
    company: { projects: "Projects", brands: "Brands", about: "About", contacts: "Contacts" },
    contactUs: "Contact us",
    call: "Give us a call",
    email: "Send us an email",
    showroom: "Simetria Showroom",
    showroomValue: "Vilnius, Lithuania",
    copyright: (year: number) => `© Copyright ${year} Simetria`,
    privacy: "Privacy Policy",
    cookie: "Cookie",
  },
};

export type Dictionary = typeof en;
