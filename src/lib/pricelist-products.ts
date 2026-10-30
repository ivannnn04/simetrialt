import { classify, type SiteCategory } from "@/lib/taxonomy";
import type { PriceListRow } from "@/lib/pricelist-pdf";

/**
 * Turns a price-list row ("Lederam C180 / ceiling lamp / …" + "LC1803 / shade Ø 80 cm black/gold /
 * black rod / gold disc / 1x15W LED board") into website product fields: a name of the form
 * "Family type – variant", a description with the specification, colour, dimensions and typology.
 * The variant part of the name is what groups sizes and colours into one product card.
 */

export type PriceListProduct = {
  sku: string;
  name: string;
  description: string;
  colour: string;
  dimensions: string;
  typology: string;
  category: SiteCategory;
  /** family + type words, used to find the product page on the supplier's website */
  family: string;
  typeHint: string;
  netPrice: number;
};

/** Segments of the description that are technical rather than a visible option. */
const TECH_RE =
  /\bLED\b|\bW\b|\d+x[\d,.]+W|bulb|dimm|driver|board|push|triac|dali|on request|see page|not supplied|E27|E14|G4|G9|GU10|\bIP\d|max |connect|strip|wireless|on\/off|version|available|touch|not incl|\*|cable|jack|tensioner|plug|rechargeable|battery|lumen|\blm\b|kelvin|\bV\b|\bHz\b|socket/i;
const KEEP_RE = /^(shade|shades|disc|discs|base|rod|rods|ring|structure|glass|sphere)\b/i;
const COLOUR_RE =
  /\b(black|white|gold|golden|copper|brass|bronze|silver|nickel|chrome|satin|matt|matte|grey|gray|anthracite|graphite|blue|red|green|yellow|orange|pink|beige|ivory|cream|brown|walnut|oak|ash|natural|transparent|transp\.|smoke|amber|colourful|colorful|fluo|rust|iron|steel|aluminium|aluminum|wood|glass|crystal|rough|waxed|vintage|untreated|burnished|opal|opaline|frosted|clear|alabaster|marble|leather|fabric|velvet|linen)\b/i;
const SIZE_RE = /\d+(?:[.,]\d+)?\s*(cm|mm|m)\b|Ø\s*\d|\b\d{2,4}\s*x\s*\d{2,4}\b|\bH\s*\d+/i;
const KELVIN_RE = /\b(\d{4})\s*K\b/;
/** Type segments that describe the product rather than its electrics. */
const TYPE_WORD_RE = /lamp|light|chandelier|flex|sofa|chair|armchair|table|bed|stool|desk|shelf|cabinet|sideboard|mirror|rug|vase|bench|console/i;
const TYPE_TECH_RE = /\bV\b|dimm|bulb|driver|board|plug|version|not incl|\d+\s*-\s*\d+V/i;

const splitSegments = (s: string) => s.split(/\s+\/\s+/).map((x) => x.trim()).filter(Boolean);

export function productFromPriceRow(row: PriceListRow, brand: string): PriceListProduct {
  const family = row.family.trim();
  const typeClean = row.type.replace(/\s+110V.*$/i, "").replace(/\s*\/\s*$/, "").trim() || row.type;
  const typeSegs = splitSegments(typeClean);
  const typeMain = typeSegs.filter((s) => TYPE_WORD_RE.test(s) && !TYPE_TECH_RE.test(s));
  const shortType = typeMain.join(" ").replace(/\s+/g, " ").trim() || typeSegs[0] || "";
  const typeSize = typeSegs.filter((s) => SIZE_RE.test(s) && !/flex/i.test(s));

  const led = row.desc.match(/(\d+)x[\d,.]+W/);
  let kelvin = "";
  const tokens: string[] = [];
  for (const s of splitSegments(row.variant ?? row.desc)) {
    const k = s.match(KELVIN_RE);
    if (k) kelvin = `${k[1]}K`;
    if (TECH_RE.test(s) && !KEEP_RE.test(s)) continue;
    if (/^\d+x[\d,.]+W/i.test(s)) continue;
    tokens.push(s.replace(/\s+\d+x[\d,.]+W.*$/i, "").trim());
  }
  const all = [...typeSize.filter((ts) => !tokens.some((t) => t.includes(ts.trim()))), ...tokens].filter(Boolean);
  // "Filigree Floor Lamp" already says what it is: no "floor lamp" after it
  const noun = (s: string) => (s.toLowerCase().split(/\s+/).pop() ?? "").replace(/s$/, "");
  let name = (shortType && noun(family) === noun(shortType) ? family : `${family} ${shortType}`).trim();
  if (all.length) name += ` – ${all.join(", ")}`;
  if (kelvin) name += `, ${kelvin}`;
  if (!all.length && led) name += ` – ${led[1]} LED`;

  const colour = tokens.filter((t) => COLOUR_RE.test(t)).join(", ");
  const dimensions = all.filter((t) => SIZE_RE.test(t)).join(", ");
  const taxonomy = classify({ type: `${typeClean} ${name}`, name, section: family });
  const description = row.spec
    ? `${family}${brand ? ` by ${brand}` : ""}${typeClean ? ` – ${typeClean}` : ""}${row.designer ? `, design ${row.designer}` : ""}.\n\n${row.variant ? `Finish: ${row.variant}\n` : ""}${row.spec}`
    : `${family}${brand ? ` by ${brand}` : ""} – ${typeClean}.\n\nSpecification: ${row.desc}` + (kelvin ? `\nColour temperature: ${kelvin}` : "");
  return {
    sku: row.sku,
    name,
    description,
    colour,
    dimensions,
    typology: taxonomy.typology,
    category: taxonomy.category,
    family,
    typeHint: shortType,
    netPrice: row.price,
  };
}

/** Within one import, products with the same name get the LED count appended so every name is unique. */
export function disambiguateNames(items: { name: string; description: string }[]): void {
  const groups = new Map<string, number[]>();
  items.forEach((it, i) => groups.set(it.name, [...(groups.get(it.name) ?? []), i]));
  for (const idxs of groups.values()) {
    if (idxs.length < 2) continue;
    const leds = idxs.map((i) => items[i].description.match(/(\d+)x[\d,.]+W/)?.[1] ?? "");
    if (new Set(leds).size > 1) idxs.forEach((i, n) => leds[n] && (items[i].name += `, ${leds[n]} LED`));
  }
  // still the same name (e.g. two base models the list does not name): tell them apart by article number
  const again = new Map<string, number[]>();
  items.forEach((it, i) => again.set(it.name, [...(again.get(it.name) ?? []), i]));
  for (const idxs of again.values()) if (idxs.length > 1) idxs.forEach((i) => ("sku" in items[i] ? (items[i].name += ` (${(items[i] as { sku: string }).sku})`) : null));
}
