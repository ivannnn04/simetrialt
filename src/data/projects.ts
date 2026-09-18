export type ProjectType = "private" | "public" | "other";

export type Project = {
  slug: string;
  name: string;
  category: string;
  type: ProjectType;
  image: string;
  /** Detail page content (Figma "Case page") */
  kind: string;
  aboutTitle: string;
  about: string[];
  sectionTitle: string;
  sectionText: string;
  specs: [string, string][];
  /** "5 section" (Figma 4217:47594): lighting story next to a 687×480 photo */
  lightTitle: string;
  light: string[];
};

const DEFAULT_ABOUT = [
  "The refurbishment focused on creating elegant, welcoming spaces that combine contemporary aesthetics with everyday comfort. Carefully selected furniture enhances the character of the interiors while meeting the durability and functionality required by the client. The result is a refined environment designed to elevate the everyday experience.",
  "Every furnishing element was chosen to achieve a balance between visual appeal and long-term performance. From private rooms to shared areas, the furniture contributes to a cohesive interior language while supporting the comfort, functionality, and flexibility expected in a modern space.",
];

const DEFAULT_LIGHT = [
  "Custom lighting engineering required precise calculations to harmonize with the architectural lines. Every fixture was strategically positioned to define spatial zones, accent high-end finishes, and maintain a seamless visual flow across all public areas.",
  "By blending ambient glow with targeted accent illumination, the design creates a layered atmosphere that shifts fluidly from day to night, ensuring guests experience both functional clarity and a warm, inviting ambiance throughout the entire space.",
];

const DEFAULT_SECTION =
  "The project demonstrates how thoughtfully integrated furniture can transform spaces into inviting destinations. By combining premium craftsmanship, high-quality materials, and timeless design, the result meets operational needs and leaves a lasting impression.";

function project(
  p: Pick<Project, "slug" | "name" | "category" | "type" | "kind"> & Partial<Project>
): Project {
  return {
    image: `/images/projects/${p.slug}/cover.jpg`,
    aboutTitle: "Furniture That Supports Every Space",
    about: DEFAULT_ABOUT,
    sectionTitle: "Crafted for Lasting Impressions",
    sectionText: DEFAULT_SECTION,
    lightTitle: "Balance of Light and Form",
    light: DEFAULT_LIGHT,
    specs: [
      ["Status", "Built"],
      ["Type", p.kind],
      ["Scale", "140 guest rooms + public areas"],
      ["Timeline", "14 months"],
      ["Engineering", "CMCU Engineering Co, Ltd"],
      ["Brands & Products Used", "Marset, Sancal, Custom joinery, Pedrali"],
      ["Services Applied", "Lighting design, Bespoke interior solutions, Installation & after-sales"],
    ],
    ...p,
  };
}

// Placeholder list mirroring the Figma "Projects page / ver 4" grid.
// Move to the CMS (Prisma model + admin CRUD) once real projects are available.
export const PROJECTS: Project[] = [
  project({ slug: "baltic-innovation-hq", name: "Baltic Innovation HQ", category: "Residential · Custom fixtures", type: "private", kind: "Residential" }),
  project({ slug: "prusta-jogailos", name: "PRUSTA Jogailos butas", category: "Residential · Lighting design", type: "private", kind: "Apartment" }),
  project({ slug: "vilnius-loft-kitchen", name: "Vilnius Loft Kitchen", category: "Residential · Bespoke interior", type: "private", kind: "Residential" }),
  project({ slug: "seaside-residence", name: "Seaside Residence", category: "Residential · Smart home", type: "private", kind: "Residential" }),
  project({ slug: "modern-workspace", name: "Modern Workspace", category: "Office · Lighting design", type: "public", kind: "Office" }),
  project({ slug: "riverside-restaurant", name: "Riverside Restaurant", category: "Hospitality · Custom fixtures", type: "public", kind: "Hospitality" }),
  project({ slug: "hotel-vilnia", name: "Hotel Vilnia", category: "Hospitality · Furniture", type: "public", kind: "Hospitality" }),
  project({ slug: "gallery-lighting", name: "Contemporary Art Gallery", category: "Culture · Lighting design", type: "other", kind: "Culture" }),
];

export function getProject(slug: string): Project | undefined {
  return PROJECTS.find((p) => p.slug === slug);
}
