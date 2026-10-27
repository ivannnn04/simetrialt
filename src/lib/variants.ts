/** Same rules as lib/slug.ts, kept local so this module has no path-alias imports (unit-testable with plain node). */
const slugify = (input: string) =>
  input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 160);

/**
 * Product variants: SKU-level rows that are the same design in another colour, finish, colour
 * temperature or dimming option share a group and appear as one card on the website, with the
 * options as selectors on the product page. Sizes stay separate products (different photos,
 * different names), which is how the team wants to browse them.
 *
 * The rules below derive the group and the variant attributes from what the supplier wrote;
 * `confirmGroups` in ai.ts can refine the result when an API key is configured.
 */

export type VariantAttrs = Record<string, string>;
export type Derived = { groupKey: string; attrs: VariantAttrs; label: string; baseName: string };

const COLOUR_WORDS =
  "black|white|gold|golden|copper|brass|bronze|silver|nickel|chrome|satin|matt|matte|glossy|grey|gray|anthracite|graphite|blue|red|green|yellow|orange|pink|beige|ivory|cream|brown|walnut|oak|ash|natural|transparent|smoke|amber|colourful|colorful|fluo|multicolou?r|rust|terracotta|sand|taupe|olive|navy|burgundy|bordeaux|champagne|rose|lilac|violet|purple|turquoise|teal|mint|coral|clear|frosted|opal";
const COLOUR_RE = new RegExp(`\\b(${COLOUR_WORDS})\\b`, "i");
const SIZE_RE = /\d+(?:[.,]\d+)?\s*(cm|mm|m)\b|Ø\s*\d|\b\d{2,4}\s*x\s*\d{2,4}\b/i;
const KELVIN_RE = /\b(\d{4})\s*K\b/;
const DIMMER_RE = /\b(triac|dali|push dimm\w*|push dimmer|wireless dimming|on\/off|not dimmable|1-10V|0-10V|phase-cut)\b/i;

const clean = (s: string) => s.replace(/\s+/g, " ").replace(/^[\s,–-]+|[\s,–-]+$/g, "").trim();

/**
 * Splits a product into its base name (shared by the group) and variant attributes.
 * Works on names of the form "Family type – black, 2700K" as well as plain supplier names.
 */
export function deriveVariant(p: { name: string; brand?: string | null; typology?: string | null; colour?: string | null; description?: string | null; sku?: string | null }): Derived {
  const name = clean(p.name);
  const attrs: VariantAttrs = {};
  let base = name;
  let variantPart = "";

  // "Base – variant" convention used by the import
  const dash = name.match(/^(.*?)\s+[–—-]\s+(.*)$/);
  if (dash) {
    base = dash[1];
    variantPart = dash[2];
  }

  // colour temperature belongs to the variant wherever it is written
  const k = name.match(KELVIN_RE) ?? (p.description ?? "").match(KELVIN_RE);
  if (k) {
    attrs["Colour temperature"] = `${k[1]}K`;
    base = clean(base.replace(KELVIN_RE, "").replace(/,\s*$/, ""));
    variantPart = clean(variantPart.replace(KELVIN_RE, ""));
  }

  // tokens of the variant part: sizes go back to the base (separate products), the rest are options
  const tokens = variantPart
    .split(/\s*,\s*/)
    .map(clean)
    .filter(Boolean);
  const sizeTokens = tokens.filter((t) => SIZE_RE.test(t));
  const optionTokens = tokens.filter((t) => !SIZE_RE.test(t));
  if (sizeTokens.length) base = clean(`${base} ${sizeTokens.join(", ")}`);
  const colourTokens = optionTokens.filter((t) => COLOUR_RE.test(t));
  const otherTokens = optionTokens.filter((t) => !COLOUR_RE.test(t));
  if (colourTokens.length) attrs.Colour = colourTokens.join(", ");
  else if (p.colour && COLOUR_RE.test(p.colour)) attrs.Colour = clean(p.colour);
  if (otherTokens.length) attrs.Finish = otherTokens.join(", ");

  // dimming option from the spec when the name doesn't carry it
  const dim = (p.description ?? "").match(DIMMER_RE);
  if (dim && !dash) attrs.Dimming = dim[1].replace(/dimm\w*/i, "dimming");

  // plain supplier names: strip a trailing colour ("Ale ceiling lamp white")
  if (!dash && !attrs.Colour) {
    const m = base.match(new RegExp(`^(.*\\S)\\s+(${COLOUR_WORDS})$`, "i"));
    if (m) {
      base = clean(m[1]);
      attrs.Colour = m[2].toLowerCase();
    }
  }

  const label = Object.values(attrs).join(", ");
  const groupKey = slugify([p.brand ?? "", p.typology ?? "", base].join(" ")) || slugify(p.sku ?? name);
  return { groupKey, attrs, label, baseName: base };
}

/** Order of selector rows on the product page. */
export const AXIS_ORDER = ["Colour", "Finish", "Colour temperature", "Dimming", "Material", "Size"];

export function sortAxes(keys: string[]): string[] {
  return [...keys].sort((a, b) => {
    const ia = AXIS_ORDER.indexOf(a);
    const ib = AXIS_ORDER.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
  });
}

export function attrsOf(json: unknown): VariantAttrs {
  if (!json || typeof json !== "object" || Array.isArray(json)) return {};
  const out: VariantAttrs = {};
  for (const [k, v] of Object.entries(json as Record<string, unknown>)) if (typeof v === "string" && v) out[k] = v;
  return out;
}
