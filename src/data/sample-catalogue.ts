import type { ProductCardData } from "@/components/catalogue/ProductCard";
import type { FilterGroup } from "@/components/catalogue/Filters";

/**
 * Static catalogue used while the database has no published products, so the
 * category / typology / brand / material / display / price filters can be tested.
 */
export type SampleProduct = {
  id: string;
  name: string;
  category: { slug: string; name: string };
  typology: string;
  brand: string;
  material: string;
  inShowroom: boolean;
  /** "Construction / Features" filter values */
  features: string[];
  priceCents: number;
  salePriceCents?: number;
  /** newest-first order for the "Newest" sort */
  added: number;
};

const P = (
  id: string,
  name: string,
  category: [string, string],
  typology: string,
  brand: string,
  material: string,
  priceCents: number,
  opts: { sale?: number; showroom?: boolean; added?: number; features?: string[] } = {}
): SampleProduct => ({
  id,
  name,
  category: { slug: category[0], name: category[1] },
  typology,
  brand,
  material,
  priceCents,
  salePriceCents: opts.sale,
  inShowroom: opts.showroom ?? true,
  features: opts.features ?? [],
  added: opts.added ?? 0,
});

export const SAMPLE_CATALOGUE: SampleProduct[] = [
  P("s-01", "Okha Repose sofa", ["furniture", "Furniture"], "Sofas", "Sancal", "Fabric", 500000, { sale: 425000, added: 14, features: ["With chaise", "Modular"] }),
  P("s-02", "Modular sofa", ["furniture", "Furniture"], "Sofas", "Pedrali", "Fabric", 740000, { added: 13 , features: ["Modular", "Low-profile"] }),
  P("s-03", "Lounge armchair", ["furniture", "Furniture"], "Armchairs", "Sancal", "Leather", 215000, { sale: 189000, added: 12, showroom: false , features: ["High-back"] }),
  P("s-04", "Clay dining table", ["furniture", "Furniture"], "Tables", "Kartell", "Oak", 390000, { added: 11 }),
  P("s-05", "Okha Repose", ["furniture", "Furniture"], "Tables", "Pedrali", "Marble", 500000, { added: 10, showroom: false , features: ["Low-profile"] }),
  P("s-06", "Console 02", ["furniture", "Furniture"], "Storage", "Kartell", "Oak", 270000, { added: 9 }),
  P("s-07", "n35", ["lighting", "Lighting"], "Pendant", "Marset", "Metal", 500000, { added: 8 , features: ["Dimmable"] }),
  P("s-08", "Halo pendant", ["lighting", "Lighting"], "Pendant", "Luceplan", "Glass", 128000, { added: 7 , features: ["Dimmable"] }),
  P("s-09", "Arc floor lamp", ["lighting", "Lighting"], "Floor lamps", "Marset", "Metal", 96000, { added: 6, showroom: false , features: ["Dimmable", "Rechargeable"] }),
  P("s-10", "Bell table lamp", ["lighting", "Lighting"], "Table lamps", "Luceplan", "Glass", 54000, { added: 5 }),
  P("s-11", "Tripod floor lamp", ["lighting", "Lighting"], "Floor lamps", "Tom Dixon", "Metal", 115000, { sale: 98000, added: 4, features: ["Dimmable"] }),
  P("s-12", "Ginger wall lamp", ["lighting", "Lighting"], "Wall lamps", "Marset", "Oak", 69000, { added: 3 }),
  P("s-13", "Paper pendant lamp", ["lighting", "Lighting"], "Pendant", "Tom Dixon", "Paper", 86000, { added: 2, showroom: false , features: ["Rechargeable"] }),
  P("s-14", "Linen cushion set", ["decor", "Decor (Accessories)"], "Textiles", "Sancal", "Fabric", 18000, { added: 1 , features: ["Sleeper sofa"] }),
  P("s-15", "Round wall mirror", ["decor", "Decor (Accessories)"], "Mirrors", "Kartell", "Glass", 42000, { sale: 36000, added: 0 }),
];

const eur = (cents: number) => `€${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

export function sampleToCard(p: SampleProduct): ProductCardData {
  const onSale = p.salePriceCents != null && p.salePriceCents < p.priceCents;
  return {
    id: p.id,
    name: p.name,
    category: p.typology,
    price: eur(p.priceCents),
    salePrice: onSale ? eur(p.salePriceCents!) : null,
    discount: onSale ? Math.round((1 - p.salePriceCents! / p.priceCents) * 100) : null,
    href: "/catalogue",
  };
}

export type CatalogueQuery = {
  category: string[];
  typology: string[];
  brand: string[];
  material: string[];
  display: string[];
  features: string[];
  min?: number;
  max?: number;
  sort: string;
};

export function filterSamples(q: CatalogueQuery): SampleProduct[] {
  const items = SAMPLE_CATALOGUE.filter(
    (p) =>
      (!q.category.length || q.category.includes(p.category.slug)) &&
      (!q.typology.length || q.typology.includes(p.typology)) &&
      (!q.brand.length || q.brand.includes(p.brand)) &&
      (!q.material.length || q.material.includes(p.material)) &&
      (q.display.length !== 1 || p.inShowroom === (q.display[0] === "In showroom")) &&
      (!q.features.length || q.features.some((f) => p.features.includes(f))) &&
      (!q.min || p.priceCents >= q.min * 100) &&
      (!q.max || p.priceCents <= q.max * 100)
  );
  const price = (p: SampleProduct) => p.salePriceCents ?? p.priceCents;
  switch (q.sort) {
    case "newest":
      return items.sort((a, b) => b.added - a.added);
    case "price-asc":
      return items.sort((a, b) => price(a) - price(b));
    case "price-desc":
      return items.sort((a, b) => price(b) - price(a));
    case "name":
      return items.sort((a, b) => a.name.localeCompare(b.name));
    default:
      return items;
  }
}

const uniq = (xs: string[]) => Array.from(new Set(xs));

export function sampleGroups(): FilterGroup[] {
  const cats = new Map(SAMPLE_CATALOGUE.map((p) => [p.category.slug, p.category.name]));
  return [
    { key: "category", label: "Category", options: Array.from(cats, ([value, label]) => ({ value, label })) },
    { key: "typology", label: "Typology", options: uniq(SAMPLE_CATALOGUE.map((p) => p.typology)) },
    { key: "brand", label: "Brands", options: uniq(SAMPLE_CATALOGUE.map((p) => p.brand)) },
    { key: "display", label: "On display", options: ["In showroom", "Online only"] },
    { key: "material", label: "Material", options: uniq(SAMPLE_CATALOGUE.map((p) => p.material)) },
    { key: "features", label: "Construction / Features", options: uniq(SAMPLE_CATALOGUE.flatMap((p) => p.features)) },
  ];
}

export function sampleCategoryName(slug: string): string | undefined {
  return SAMPLE_CATALOGUE.find((p) => p.category.slug === slug)?.category.name;
}
