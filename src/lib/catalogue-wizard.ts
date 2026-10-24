/** Types shared by the catalogue import wizard (server actions and the admin UI). */

export type DraftImage = {
  /** "catalogue": extracted from the PDF (data URL); "web": found online (remote URL) */
  kind: "catalogue" | "web";
  src: string;
  thumb?: string;
  source?: string;
  selected: boolean;
};

export type DraftItem = {
  idx: number;
  sku: string;
  name: string;
  description: string;
  category: string;
  brand: string;
  typology: string;
  material: string;
  colour: string;
  dimensions: string;
  weight: string;
  /** euros as typed in the form, e.g. "699.00" */
  price: string;
  salePrice: string;
  /** where the data came from, for the badge in the UI */
  from: ("pdf" | "pricelist")[];
  page: number | null;
  existing: { id: string; name: string } | null;
  images: DraftImage[];
};

export type Draft = {
  token: string;
  filename: string;
  createdAt: number;
  aiUsed: boolean;
  imageSearch: boolean;
  warnings: string[];
  items: DraftItem[];
  error?: string;
};

/** What the UI sends back for each item on submit. */
export type SubmitItem = {
  idx: number;
  include: boolean;
  sku: string;
  name: string;
  description: string;
  category: string;
  brand: string;
  typology: string;
  material: string;
  colour: string;
  dimensions: string;
  weight: string;
  price: string;
  salePrice: string;
  /** catalogue images by index into the stored draft, web images by URL */
  images: ({ kind: "catalogue"; index: number } | { kind: "web"; src: string })[];
};

export type PublishResult = {
  created: number;
  updated: number;
  errors: string[];
  products: { id: string; slug: string; name: string }[];
  error?: string;
};

/** Product page text: the description followed by the specification lines. */
export function composeDescription(i: Pick<SubmitItem, "description" | "colour" | "dimensions" | "weight">): string {
  const spec = [
    i.colour && `Colour: ${i.colour}`,
    i.dimensions && `Dimensions: ${i.dimensions}`,
    i.weight && `Weight: ${i.weight}`,
  ].filter(Boolean);
  return [i.description.trim(), spec.join("\n")].filter(Boolean).join("\n\n");
}
