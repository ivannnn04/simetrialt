import type { Project, ProjectCopy, ProjectType } from "@/data/projects";

/**
 * Projects from the old simetria.lt (WordPress "portfolio"): title, credits, brands and photos.
 * Each record becomes a project with English copy and its own Lithuanian copy, written only
 * from the facts the old page lists (no invented story).
 */

export type LegacyProject = {
  slug: string;
  title: string;
  type: ProjectType;
  year: string;
  authors: string;
  photographer: string;
  lighting: string[];
  furniture: string[];
  other: string[];
  awards: string;
  /** full URLs, or paths under https://www.simetria.lt/wp-content/uploads/ */
  images: string[];
};

export const LEGACY_UPLOADS = "https://www.simetria.lt/wp-content/uploads/";

/** English names for the old Lithuanian titles. */
const EN_TITLES: Record<string, string> = {
  "apartamentai-uzupyje": "Apartment in Užupis",
  "apartamentai-vilniaus-senamiestyje": "Apartment in Vilnius Old Town",
  "apartamentai-vilniuje": "Apartment in Vilnius",
  "bandeliu-kepykla-vilniuje": "Bun bakery in Klaipėda",
  "biuro-interjeras-vilniuje": "Office interior in Vilnius",
  "butas-istoriniame-mejeriu-name": "Flat in the historic Mejeriai house",
  "butas-uzupyje": "Flat in Užupis",
  "butas-vilniuje-9": "Flat in Vilnius",
  "buto-interjeras-vilniaus-senamiestyje": "Flat interior in Vilnius Old Town",
  "creme-de-la-creme-akropolis-vilnius": "Crème de la Crème Akropolis, Vilnius",
  "creme-de-la-creme-didzioji-g-vilnius": "Crème de la Crème Didžioji St., Vilnius",
  "creme-de-la-creme-parduotuve-klaipedoje": "Crème de la Crème store in Klaipėda",
  "creme-de-la-creme-talinas-estija": "Crème de la Crème, Tallinn (Estonia)",
  "creme-de-la-creme-vilnius": "Crème de la Crème, Vilnius",
  "evelina-talandzeviciene-architekturos-studija-plazma-creme-de-la-creme-parduotuve": "Crème de la Crème store, Vilnius",
  "fortevento-ofiso-interjeras": "Fortevento office interior",
  "grozio-salonas-junora": "Junora beauty salon",
  "gyvenamasis-namas-papeje-latvija": "Family house in Pape, Latvia",
  "hilton-viesbutis-vilniuje": "Hilton hotel in Vilnius",
  "interjeras-vilniuje-2": "Interior in Vilnius",
  "kavine-city-lounge": "City Lounge café",
  "klubas-exit-vilnius": "Exit club, Vilnius",
  "komercinis-interjeras": "Commercial interior",
  "loft-town-vilnius": "Loft Town, Vilnius",
  "membershop-biuro-interjeras": "Membershop office interior",
  "membershop-parduotuve": "Membershop store",
  "membershop-prekiu-atidavimo-punktas": "Membershop pick-up point",
  "momo-grill-klaipeda": "Momo Grill, Klaipėda",
  "namas-marijampoleje": "House in Marijampolė",
  "namas-vilniuje": "House in Vilnius",
  namas_kaune: "House in Kaunas",
  "namo-interjeras-kaune": "House interior in Kaunas",
  "ofisas-rygoje": "Office in Riga",
  "ofisas-rygoje-2": "Office in Riga",
  "porto-viesbutis-plungeje": "Porto hotel in Plungė",
  "privataus-buto-interjeras": "Private flat interior",
  "privataus-namo-interjeras-kaune": "Private house interior in Kaunas",
  "privatus-buto-interjeras-druskininkuose": "Private flat interior in Druskininkai",
  "privatus-buto-interjeras-druskininkuose-2": "Private flat interior in Druskininkai",
  "privatus-buto-interjeras-vilniuje": "Private flat interior in Vilnius",
  "privatus-buto-interjeras-vilniuje-2": "Private flat interior in Vilnius",
  "privatus-buto-interjeras-vilniuje-3": "Private flat interior in Vilnius",
  "privatus-buto-interjeras-vilniuje-4": "Private flat interior in Vilnius",
  "privatus-buto-interjeras": "Private flat interior",
  "privatus-interjeras-2": "Private house interior",
  "privatus-interjeras-rygoje": "Private interior in Riga",
  "privatus-interjeras-siauliuose": "Private interior in Šiauliai",
  "privatus-interjeras-vilniuje-5": "Private cottage interior in Vilnius",
  "privatus-projektas": "Private project",
  "rasos-virtuve-vilnius": "Rasos virtuvė, Vilnius",
  "reklamos-agenturos-biuras": "Advertising agency office",
  "restorano-sale-vilniuje": "Restaurant hall in Vilnius",
  "salono-interjeras": "Salon interior",
  "sauletekio-butas": "Saulėtekis flat",
  "seven-baras-klaipedoje": "Seven bar in Klaipėda",
  "skinny-grozio-ir-estetikos-studija-vilniuje": "Skinny beauty and aesthetics studio, Vilnius",
  "sushi-restoranas-vilniuje": "Sushi restaurant in Vilnius",
  "sushi-stop": "Sushi Stop",
  "verslo-centras-kaune": "Business centre in Kaunas",
  "viesasis-projektas": "Offices in Vilnius",
  "viesbutis-smelio-juosta-nida": "Smėlio juosta hotel, Nida",
  wakecrib: "WakeCrib, Tauragė",
  "zalgirio-arenos-restoranas": "Žalgiris Arena restaurant",
};

/** Tidier Lithuanian titles where the old page used capitals or a bare name. */
const LT_TITLES: Record<string, string> = {
  "biuro-interjeras-vilniuje": "Biuro interjeras Vilniuje",
  "butas-uzupyje": "Butas Užupyje",
  "creme-de-la-creme-talinas-estija": "Crème de la Crème, Talinas (Estija)",
  "creme-de-la-creme-vilnius": "Crème de la Crème, Vilnius",
  "creme-de-la-creme-parduotuve-klaipedoje": "„Crème de la Crème“ parduotuvė Klaipėdoje",
  "evelina-talandzeviciene-architekturos-studija-plazma-creme-de-la-creme-parduotuve": "„Crème de la Crème“ parduotuvė Vilniuje",
  "privatus-interjeras-7": "Privatus interjeras",
  "skinny-grozio-ir-estetikos-studija-vilniuje": "„Skinny“ grožio ir estetikos studija Vilniuje",
  "restorano-sale-vilniuje": "Restorano salė Vilniuje",
};

const AWARDS_EN: Record<string, string> = {
  "membershop-biuro-interjeras": "Nominated for the 2012 Golden Palette award for the best office interior.",
};

type Kind = "Apartment" | "House" | "Residential" | "Office" | "Hospitality" | "Retail" | "Commercial" | "Beauty";

const KIND_LT: Record<Kind, string> = {
  Apartment: "Butas",
  House: "Namas",
  Residential: "Būstas",
  Office: "Biuras",
  Hospitality: "Svetingumo objektas",
  Retail: "Prekyba",
  Commercial: "Komercinė erdvė",
  Beauty: "Grožio salonas",
};

function kindOf(r: LegacyProject): Kind {
  const s = `${r.slug} ${r.title}`.toLowerCase();
  if (/grozio|salon|skinny/.test(s)) return "Beauty";
  if (/viesbut|viešbut|restoran|kavin|baras|bar\b|kepykl|klubas|grill|sushi|virtuv|wakecrib|lounge/.test(s)) return "Hospitality";
  if (/biur|ofis|verslo-centras|agentur|viesasis-projektas/.test(s)) return "Office";
  if (/parduotuv|creme|atidavimo/.test(s)) return "Retail";
  if (/komercin/.test(s)) return "Commercial";
  if (/namas|namo|kotedz|kotedž|house/.test(s)) return "House";
  if (/butas|buto|apartament|sauletekio/.test(s)) return "Apartment";
  return "Residential";
}

const list = (xs: string[], and: string) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} ${and} ${xs[xs.length - 1]}`);
const clean = (s: string) => s.replace(/\s+/g, " ").replace(/\s+,/g, ",").trim();
const imageUrl = (p: string) => (/^https?:\/\//.test(p) ? p : LEGACY_UPLOADS + p.replace(/^\/+/, ""));

const EN_KIND_PHRASE: Record<Kind, string> = {
  Apartment: "An apartment",
  House: "A private house",
  Residential: "A private interior",
  Office: "An office",
  Hospitality: "A hospitality interior",
  Retail: "A retail interior",
  Commercial: "A commercial interior",
  Beauty: "A beauty salon",
};
const LT_KIND_PHRASE: Record<Kind, string> = {
  Apartment: "Buto interjeras",
  House: "Privataus namo interjeras",
  Residential: "Privatus interjeras",
  Office: "Biuro interjeras",
  Hospitality: "Svetingumo objekto interjeras",
  Retail: "Prekybos erdvės interjeras",
  Commercial: "Komercinės erdvės interjeras",
  Beauty: "Grožio salono interjeras",
};

export function legacyToProject(r: LegacyProject): Project {
  const kind = kindOf(r);
  const authors = clean(r.authors);
  const photographer = clean(r.photographer);
  const year = r.year;
  const nameLt = LT_TITLES[r.slug] ?? clean(r.title);
  const nameEn = EN_TITLES[r.slug] ?? nameLt;
  const gallery = r.images.map(imageUrl);

  const en: string[] = [];
  en.push(`${EN_KIND_PHRASE[kind]}${year ? ` completed in ${year}` : ""}${authors ? `, designed by ${authors}` : ""}.`);
  const supplied = [r.lighting.length && `lighting by ${list(r.lighting, "and")}`, r.furniture.length && `furniture by ${list(r.furniture, "and")}`, r.other.length && `accessories by ${list(r.other, "and")}`].filter(Boolean) as string[];
  if (supplied.length) en.push(`Simetria supplied ${list(supplied, "and")}.`);
  if (AWARDS_EN[r.slug]) en.push(AWARDS_EN[r.slug]);
  if (photographer) en.push(`Photography: ${photographer}.`);

  const lt: string[] = [];
  lt.push(`${LT_KIND_PHRASE[kind]}${year ? `, įgyvendintas ${year} m.` : "."}${authors ? ` Autoriai: ${authors}.` : ""}`);
  const suppliedLt = [r.lighting.length && `šviestuvai – ${list(r.lighting, "ir")}`, r.furniture.length && `baldai – ${list(r.furniture, "ir")}`, r.other.length && `aksesuarai – ${list(r.other, "ir")}`].filter(Boolean) as string[];
  if (suppliedLt.length) lt.push(`„Simetria“ tiekė: ${suppliedLt.join("; ")}.`);
  if (r.awards) lt.push(clean(r.awards));
  if (photographer) lt.push(`Fotografas: ${photographer}.`);

  const specsEn: [string, string][] = [
    ["Type", kind],
    ...(authors ? [["Design", authors] as [string, string]] : []),
    ...(r.lighting.length ? [["Lighting", r.lighting.join(", ")] as [string, string]] : []),
    ...(r.furniture.length ? [["Furniture", r.furniture.join(", ")] as [string, string]] : []),
    ...(r.other.length ? [["Accessories", r.other.join(", ")] as [string, string]] : []),
    ...(photographer ? [["Photography", photographer] as [string, string]] : []),
    ...(year ? [["Year", year] as [string, string]] : []),
  ];
  const LABEL_LT: Record<string, string> = { Type: "Tipas", Design: "Autoriai", Lighting: "Šviestuvai", Furniture: "Baldai", Accessories: "Aksesuarai", Photography: "Fotografas", Year: "Metai" };
  const specsLt = specsEn.map(([k, v]) => [LABEL_LT[k] ?? k, k === "Type" ? KIND_LT[kind] : v] as [string, string]);

  const ltCopy: ProjectCopy = {
    name: nameLt,
    category: `${KIND_LT[kind]}${year ? ` · ${year}` : ""}`,
    kind: KIND_LT[kind],
    aboutTitle: nameLt,
    about: lt,
    sectionTitle: "",
    sectionText: "",
    lightTitle: "",
    light: [],
    specs: specsLt,
  };

  return {
    slug: r.slug.replace(/_/g, "-"),
    name: nameEn,
    category: `${kind}${year ? ` · ${year}` : ""}`,
    type: r.type,
    kind,
    image: gallery[0] ?? "",
    aboutTitle: nameEn,
    about: en,
    sectionTitle: "",
    sectionText: "",
    lightTitle: "",
    light: [],
    specs: specsEn,
    gallery,
    lt: ltCopy,
    source: `https://www.simetria.lt/portfolio/${r.slug}/`,
  };
}

/** Accepts the JSON the old-site export produces (an array of LegacyProject). */
export function parseLegacyProjects(json: string): LegacyProject[] {
  const data = JSON.parse(json) as unknown;
  if (!Array.isArray(data)) throw new Error("Tikėtasi JSON masyvo");
  return data
    .filter((r): r is LegacyProject => Boolean(r && typeof r === "object" && typeof (r as LegacyProject).slug === "string" && Array.isArray((r as LegacyProject).images)))
    .map((r): LegacyProject => ({
      slug: String(r.slug),
      title: String(r.title ?? r.slug),
      type: r.type === "public" ? "public" : r.type === "other" ? "other" : "private",
      year: String(r.year ?? ""),
      authors: String(r.authors ?? ""),
      photographer: String(r.photographer ?? ""),
      lighting: (r.lighting ?? []).map(String),
      furniture: (r.furniture ?? []).map(String),
      other: (r.other ?? []).map(String),
      awards: String(r.awards ?? ""),
      images: r.images.map(String).filter(Boolean),
    }))
    .filter((r) => r.images.length > 0);
}
