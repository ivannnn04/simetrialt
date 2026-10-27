import { db, tryDb } from "@/lib/db";
import { formatPrice } from "@/lib/slug";
import { SAMPLE_PRODUCTS, toCard } from "@/lib/products";
import { PLACEHOLDER_IMAGE, PRODUCT_PLACEHOLDER_IMAGE } from "@/lib/placeholder";
import { SAMPLE_CATALOGUE, sampleToCard, type SampleProduct } from "@/data/sample-catalogue";
import type { ProductCardData } from "@/components/catalogue/ProductCard";
import { attrsOf, deriveVariant, sortAxes } from "@/lib/variants";

export type ProductVariant = {
  /** product id of this variant (each variant is its own SKU-level product) */
  id: string;
  slug: string;
  sku: string | null;
  label: string;
  image: string | null;
  images: (string | null)[];
  price: string;
  oldPrice?: string;
  priceCents: number;
  attrs: Record<string, string>;
  description: string;
  details: ProductDetail[];
  material: string;
};
export type ProductDetail = { title: string; body: string };

/** Everything the product page (Figma 4217:46868) renders, from the database or the sample catalogue. */
export type ProductView = {
  id: string;
  name: string;
  brand: string;
  category?: { slug: string; name: string };
  typology?: string;
  price: string;
  oldPrice?: string;
  description: string;
  /** gallery, first image is the product cut-out on a light surface */
  images: (string | null)[];
  colorLabel: string;
  /** this product and its siblings (same group); the product itself is always included */
  variants: ProductVariant[];
  /** selector rows, in display order, with the distinct values of each axis */
  axes: { key: string; values: string[] }[];
  materials: string[];
  details: ProductDetail[];
  related: ProductCardData[];
};

export const DESCRIPTION =
  "A hand-blown glass pendant with a softly diffused silhouette, designed to anchor a dining or reception area without overwhelming it. Suited to both residential and hospitality specification.";

const LOREM =
  "Lorem ipsum dolor sit amet consectetur. Orci porttitor nisl lectus nunc est egestas volutpat mauris. Risus erat sagittis tempor pellentesque porttitor tincidunt risus. Sagittis.";

const DETAILS: ProductDetail[] = [
  { title: "Dimensions", body: LOREM },
  { title: "Materials & finish", body: LOREM },
  { title: "Lamping & certification", body: LOREM },
  { title: "Lead time", body: LOREM },
];

const uniq = (xs: string[]) => Array.from(new Set(xs)).filter(Boolean);

const sampleVariant = (id: string, label: string, price: string, description: string, material: string): ProductVariant => ({
  id,
  slug: id,
  sku: null,
  label,
  image: PRODUCT_PLACEHOLDER_IMAGE,
  images: defaultImages(),
  price,
  priceCents: 0,
  attrs: { Colour: label },
  description,
  details: DETAILS,
  material,
});
const defaultVariants = (id: string, price: string, description: string, material: string): ProductVariant[] =>
  ["Red", "Ochre", "Green", "Black"].map((label) => sampleVariant(`${id}-${label.toLowerCase()}`, label, price, description, material));
const defaultAxes = () => [{ key: "Colour", values: ["Red", "Ochre", "Green", "Black"] }];

/**
 * Product text as the import writes it: a description, then "Specification: …" and
 * "Colour: / Dimensions: / Weight:" lines. Those become accordion rows instead of one blob.
 */
export function splitDescription(raw: string, material: string): { description: string; details: ProductDetail[] } {
  const text = raw.replace(/<[^>]+>/g, "").trim();
  const lines = text.split(/\r?\n+/).map((l) => l.trim()).filter(Boolean);
  const rows: ProductDetail[] = [];
  const body: string[] = [];
  for (const l of lines) {
    const m = l.match(/^(Specification|Dimensions|Colour|Color|Weight|Materials?|Finish|Light source|Lamping)\s*:\s*(.+)$/i);
    if (m) rows.push({ title: m[1].replace(/^Color$/i, "Colour").replace(/^Material$/i, "Materials"), body: m[2].trim() });
    else body.push(l);
  }
  if (material && !rows.some((r) => /^Materials?/i.test(r.title))) rows.push({ title: "Materials & finish", body: material });
  return { description: body.join("\n\n"), details: rows };
}

const defaultImages = () => [PRODUCT_PLACEHOLDER_IMAGE, PLACEHOLDER_IMAGE, PLACEHOLDER_IMAGE, PLACEHOLDER_IMAGE];

const eur = (cents: number) => `€${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

function fromSample(p: SampleProduct): ProductView {
  const onSale = p.salePriceCents != null && p.salePriceCents < p.priceCents;
  const related = SAMPLE_CATALOGUE.filter((o) => o.id !== p.id && o.category.slug === p.category.slug).map(sampleToCard);
  return {
    id: p.id,
    name: p.name,
    brand: p.brand.toUpperCase(),
    category: p.category,
    typology: p.typology,
    price: onSale ? eur(p.salePriceCents!) : `From ${eur(p.priceCents)}`,
    oldPrice: onSale ? eur(p.priceCents) : undefined,
    description: DESCRIPTION,
    images: defaultImages(),
    colorLabel: "Red",
    variants: defaultVariants(p.id, onSale ? eur(p.salePriceCents!) : `From ${eur(p.priceCents)}`, DESCRIPTION, p.material),
    axes: defaultAxes(),
    materials: uniq([p.material, "Brass", "Oak", "Glass"]).slice(0, 4),
    details: DETAILS,
    related: related.length ? related : SAMPLE_CATALOGUE.filter((o) => o.id !== p.id).slice(0, 6).map(sampleToCard),
  };
}

/** Header search / home slider mock cards ("sample-N") map onto the sample catalogue by name. */
function fromSampleCard(card: ProductCardData): ProductView {
  const match = SAMPLE_CATALOGUE.find((p) => p.name.toLowerCase() === card.name.toLowerCase());
  if (match) return { ...fromSample(match), id: card.id };
  return {
    id: card.id,
    name: card.name,
    brand: "MARSET",
    typology: card.category,
    price: card.salePrice ?? `From ${card.price}`,
    oldPrice: card.salePrice ? card.price : undefined,
    description: DESCRIPTION,
    images: defaultImages(),
    colorLabel: "Red",
    variants: defaultVariants(card.id, card.salePrice ?? `From ${card.price}`, DESCRIPTION, "Metal"),
    axes: defaultAxes(),
    materials: ["Metal", "Brass", "Oak", "Glass"],
    details: DETAILS,
    related: SAMPLE_CATALOGUE.slice(6, 12).map(sampleToCard),
  };
}

export async function loadProduct(slug: string): Promise<ProductView | null> {
  const product = await tryDb("loadProduct", () =>
    db.product.findFirst({
      where: { slug, published: true },
      include: { images: { orderBy: { sort: "asc" } }, category: true },
    })
  );
  if (product) {
    try {
      const price = (c: number) => formatPrice(c, product.currency);
      // the group: this product plus every published sibling with the same key (derived on the fly for older rows)
      const groupKey = product.groupKey ?? deriveVariant(product).groupKey;
      // siblings by stored key, plus older rows (no key yet) whose derived key matches: same brand and typology narrows them down
      const candidates = await db.product.findMany({
        where: {
          published: true,
          OR: [{ groupKey }, { id: product.id }, { groupKey: null, brand: product.brand, typology: product.typology }],
        },
        orderBy: [{ createdAt: "asc" }],
        include: { images: { orderBy: { sort: "asc" } } },
      });
      const siblings = candidates.filter((c) => c.id === product.id || (c.groupKey ?? deriveVariant(c).groupKey) === groupKey);
      const toVariant = (v: (typeof siblings)[number]): ProductVariant => {
        const onSale = v.salePriceCents != null && v.salePriceCents < v.priceCents;
        const attrs = Object.keys(attrsOf(v.variantAttrs)).length ? attrsOf(v.variantAttrs) : deriveVariant(v).attrs;
        const split = splitDescription(v.description ?? "", v.material ?? "");
        const imgs = v.images.map((i) => i.url);
        return {
          id: v.id,
          slug: v.slug,
          sku: v.sku,
          label: v.variantLabel || Object.values(attrs).join(", ") || v.name,
          image: imgs[0] ?? null,
          images: imgs.length ? imgs : defaultImages(),
          price: onSale ? price(v.salePriceCents!) : price(v.priceCents),
          oldPrice: onSale ? price(v.priceCents) : undefined,
          priceCents: onSale ? v.salePriceCents! : v.priceCents,
          attrs,
          description: split.description || DESCRIPTION,
          details: split.details,
          material: v.material ?? "",
        };
      };
      const variants = siblings.map(toVariant);
      const current = variants.find((v) => v.id === product.id) ?? variants[0];
      const axisKeys = sortAxes(Array.from(new Set(variants.flatMap((v) => Object.keys(v.attrs)))));
      const axes = axisKeys
        .map((key) => ({ key, values: Array.from(new Set(variants.map((v) => v.attrs[key]).filter(Boolean))) }))
        .filter((a) => a.values.length > 1 || variants.length === 1);
      const related = await db.product.findMany({
        where: { published: true, id: { notIn: siblings.map((s) => s.id) }, ...(product.categoryId ? { categoryId: product.categoryId } : {}) },
        orderBy: { updatedAt: "desc" },
        take: 12,
        include: { category: true, images: { orderBy: { sort: "asc" }, take: 2 } },
      });
      // one related card per group
      const seen = new Set<string>();
      const relatedCards = related.filter((r) => { const k = r.groupKey ?? r.id; if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 6);
      const onSale = product.salePriceCents != null && product.salePriceCents < product.priceCents;
      const minPrice = Math.min(...variants.map((v) => v.priceCents));
      const samePrice = variants.every((v) => v.priceCents === minPrice);
      return {
        id: product.id,
        name: deriveVariant(product).baseName || product.name,
        brand: (product.brand ?? "Simetria").toUpperCase(),
        category: product.category ? { slug: product.category.slug, name: product.category.name } : undefined,
        typology: product.typology ?? undefined,
        price: onSale ? price(product.salePriceCents!) : samePrice ? price(product.priceCents) : `From ${price(minPrice)}`,
        oldPrice: onSale ? price(product.priceCents) : undefined,
        description: current.description,
        images: current.images,
        colorLabel: current.attrs.Colour ?? current.label,
        variants,
        axes,
        materials: uniq([product.material ?? ""]),
        details: current.details.length ? current.details : DETAILS,
        related: relatedCards.length ? relatedCards.map(toCard) : SAMPLE_CATALOGUE.slice(0, 6).map(sampleToCard),
      };
    } catch (e) {
      console.error("loadProduct: database unavailable", e);
    }
  }
  const sample = SAMPLE_CATALOGUE.find((p) => p.id === slug);
  if (sample) return fromSample(sample);
  const card = SAMPLE_PRODUCTS.find((p) => p.id === slug);
  return card ? fromSampleCard(card) : null;
}
