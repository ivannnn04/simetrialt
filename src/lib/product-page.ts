import { db } from "@/lib/db";
import { formatPrice } from "@/lib/slug";
import { SAMPLE_PRODUCTS, toCard } from "@/lib/products";
import { PLACEHOLDER_IMAGE, PRODUCT_PLACEHOLDER_IMAGE } from "@/lib/placeholder";
import { SAMPLE_CATALOGUE, sampleToCard, type SampleProduct } from "@/data/sample-catalogue";
import type { ProductCardData } from "@/components/catalogue/ProductCard";

export type ProductVariant = { label: string; image: string | null };
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
  variants: ProductVariant[];
  materials: string[];
  details: ProductDetail[];
  related: ProductCardData[];
};

const DESCRIPTION =
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

const defaultVariants = (): ProductVariant[] =>
  ["Red", "Ochre", "Green", "Black"].map((label) => ({ label, image: PRODUCT_PLACEHOLDER_IMAGE }));

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
    variants: defaultVariants(),
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
    variants: defaultVariants(),
    materials: ["Metal", "Brass", "Oak", "Glass"],
    details: DETAILS,
    related: SAMPLE_CATALOGUE.slice(6, 12).map(sampleToCard),
  };
}

export async function loadProduct(slug: string): Promise<ProductView | null> {
  try {
    const product = await db.product.findFirst({
      where: { slug, published: true },
      include: { images: { orderBy: { sort: "asc" } }, category: true },
    });
    if (product) {
      const onSale = product.salePriceCents != null && product.salePriceCents < product.priceCents;
      const price = (c: number) => formatPrice(c, product.currency);
      const related = await db.product.findMany({
        where: { published: true, id: { not: product.id }, ...(product.categoryId ? { categoryId: product.categoryId } : {}) },
        orderBy: { updatedAt: "desc" },
        take: 6,
        include: { category: true, images: { orderBy: { sort: "asc" }, take: 2 } },
      });
      const images = product.images.map((i) => i.url);
      return {
        id: product.id,
        name: product.name,
        brand: (product.brand ?? "Simetria").toUpperCase(),
        category: product.category ? { slug: product.category.slug, name: product.category.name } : undefined,
        typology: product.typology ?? undefined,
        price: onSale ? price(product.salePriceCents!) : `From ${price(product.priceCents)}`,
        oldPrice: onSale ? price(product.priceCents) : undefined,
        description: product.description?.replace(/<[^>]+>/g, "").trim() || DESCRIPTION,
        images: images.length ? images : defaultImages(),
        colorLabel: "Red",
        variants: defaultVariants(),
        materials: uniq([product.material ?? "", "Brass", "Oak", "Glass"]).slice(0, 4),
        details: DETAILS,
        related: related.length ? related.map(toCard) : SAMPLE_CATALOGUE.slice(0, 6).map(sampleToCard),
      };
    }
  } catch (e) {
    console.error("loadProduct: database unavailable", e);
  }
  const sample = SAMPLE_CATALOGUE.find((p) => p.id === slug);
  if (sample) return fromSample(sample);
  const card = SAMPLE_PRODUCTS.find((p) => p.id === slug);
  return card ? fromSampleCard(card) : null;
}
