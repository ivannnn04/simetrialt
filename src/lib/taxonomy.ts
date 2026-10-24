/**
 * The website's product taxonomy: a product belongs to one top-level category (the catalogue
 * sections in the menu) and has a typology (the menu items that preselect the typology filter).
 * Imported products are mapped onto these so that they show up under the menu links.
 */

export const SITE_CATEGORIES = ["Furniture", "Lighting", "Decor (Accessories)"] as const;
export type SiteCategory = (typeof SITE_CATEGORIES)[number];

export const TYPOLOGIES: Record<SiteCategory, string[]> = {
  Furniture: ["Sofas", "Armchairs", "Coffee tables", "Shelving", "Sideboards", "Dining tables", "Chairs", "Bar stools", "Desks", "Office chairs", "Beds"],
  Lighting: ["Pendant Lights", "Ceiling Lights", "Wall Lights", "Table Lights", "Floor Lamps", "Recessed Lights", "Spotlights", "Systems", "Profile", "Rechargeable lights", "Bollards"],
  "Decor (Accessories)": ["Mirrors", "Rugs", "Vases & objects", "Textiles", "Wall art"],
};

/** keyword → typology. Specific rules are tried on every field before the generic ones (marked). */
const RULES: [RegExp, SiteCategory, string, boolean?][] = [
  [/office chair|task chair|swivel chair/i, "Furniture", "Office chairs"],
  [/bar stool|counter stool|stool/i, "Furniture", "Bar stools"],
  [/sofa|couch|settee|chaise|daybed/i, "Furniture", "Sofas"],
  [/armchair|lounge chair|wing chair|easy chair|recliner/i, "Furniture", "Armchairs"],
  [/\bchair/i, "Furniture", "Chairs", true],
  [/coffee table|side table|nest(ing)? table|occasional table/i, "Furniture", "Coffee tables"],
  [/dining table|extendable table|dining/i, "Furniture", "Dining tables"],
  [/\btable\b/i, "Furniture", "Dining tables", true],
  [/desk|workstation/i, "Furniture", "Desks"],
  [/bookcase|shelf|shelving|shelves|étagère|wall unit/i, "Furniture", "Shelving"],
  [/sideboard|cabinet|chest|drawer|tv bench|tv unit|console|storage|wardrobe|dresser/i, "Furniture", "Sideboards"],
  [/\bbed|mattress|headboard/i, "Furniture", "Beds"],
  [/pendant|hanging lamp|suspension|chandelier/i, "Lighting", "Pendant Lights"],
  [/ceiling (lamp|light)|flush/i, "Lighting", "Ceiling Lights"],
  [/wall (lamp|light)|sconce/i, "Lighting", "Wall Lights"],
  [/table (lamp|light)|desk lamp|work lamp|bedside lamp/i, "Lighting", "Table Lights"],
  [/floor (lamp|light)|reading lamp|standing lamp/i, "Lighting", "Floor Lamps"],
  [/recessed|downlight/i, "Lighting", "Recessed Lights"],
  [/spotlight|track light/i, "Lighting", "Spotlights"],
  [/bollard|path light|garden light/i, "Lighting", "Bollards"],
  [/rechargeable|portable (lamp|light)|battery/i, "Lighting", "Rechargeable lights"],
  [/profile|led strip/i, "Lighting", "Profile"],
  [/lamp|light|luminaire|lighting/i, "Lighting", "Pendant Lights", true],
  [/mirror/i, "Decor (Accessories)", "Mirrors"],
  [/rug|carpet/i, "Decor (Accessories)", "Rugs"],
  [/vase|bowl|object|sculpture|candle/i, "Decor (Accessories)", "Vases & objects"],
  [/cushion|throw|blanket|textile|curtain|pillow/i, "Decor (Accessories)", "Textiles"],
  [/wall art|print|poster|painting|artwork/i, "Decor (Accessories)", "Wall art"],
];

/**
 * Picks the website category and typology for a product from whatever the supplier called it:
 * catalogue section, product type, name. Falls back to Furniture with the supplier's own type.
 */
export function classify(input: { section?: string; type?: string; name?: string; description?: string }): { category: SiteCategory; typology: string } {
  const texts = [input.type, input.name, input.section, input.description].filter(Boolean) as string[];
  for (const generic of [false, true]) {
    for (const text of texts) {
      for (const [re, category, typology, isGeneric] of RULES) {
        if (Boolean(isGeneric) === generic && re.test(text)) return { category, typology };
      }
    }
  }
  return { category: "Furniture", typology: input.type?.trim() || input.section?.trim() || "" };
}

export const SITE_CATEGORY_RE = /^(furniture|lighting|decor(\s*\(accessories\))?)$/i;

/** Slug the website's menu links use for a category ("Decor (Accessories)" → "decor"). */
export function siteCategorySlug(name: string): string {
  const n = name.trim().toLowerCase();
  if (n.startsWith("decor")) return "decor";
  if (n === "furniture" || n === "lighting") return n;
  return "";
}
