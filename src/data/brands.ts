export type Brand = {
  slug: string;
  name: string;
  category: string;
  country: string;
  /** Typographic treatment for the wordmark until real logo files are added */
  mark?: { text?: string; className?: string };
  collections: { title: string; height: 458 | 366 | 275 }[];
};

// Extra placeholder collections so the horizontal strip has something to scroll through.
const EXTRA_COLLECTIONS = ["New arrivals", "Outdoor", "Storage", "Accessories"];

const collections = (titles: string[]): Brand["collections"] =>
  [...titles, ...EXTRA_COLLECTIONS].map((title, i) => ({ title, height: ([458, 366, 275, 366] as const)[i % 4] }));

// Brands from the Figma "Brands page". Placeholder details until the CMS holds them.
export const BRANDS: Brand[] = [
  { slug: "kartell", name: "Kartell", category: "Furniture", country: "Italy", mark: { className: "font-bold text-[40px] tracking-[-0.03em]" }, collections: collections(["Tables", "Seating", "Upholstered Furniture", "Small tables/Console"]) },
  { slug: "moooi", name: "Moooi", category: "Lighting", country: "Netherlands", mark: { text: "moooi", className: "text-[36px] tracking-[0.3em]" }, collections: collections(["Lighting", "Seating", "Carpets", "Accessories"]) },
  { slug: "luceplan", name: "Luceplan", category: "Lighting", country: "Italy", mark: { text: "LUCE\nPLAN", className: "font-black text-[28px] leading-[0.9] whitespace-pre" }, collections: collections(["Pendant", "Wall", "Floor", "Outdoor"]) },
  { slug: "dorelan", name: "Dorelan", category: "Beds & Mattresses", country: "Italy", mark: { text: "dorelan", className: "text-[36px] font-light tracking-[-0.02em]" }, collections: collections(["Beds", "Mattresses", "Pillows", "Accessories"]) },
  { slug: "marset", name: "Marset", category: "Lighting", country: "Spain", mark: { text: "marset", className: "font-bold text-[36px] tracking-[-0.05em]" }, collections: collections(["Pendant", "Table", "Wall", "Outdoor"]) },
  { slug: "tom-dixon", name: "Tom Dixon", category: "Lighting & Furniture", country: "United Kingdom", mark: { text: "Tom\nDixon.", className: "font-black text-[26px] leading-[0.85] whitespace-pre" }, collections: collections(["Lighting", "Furniture", "Accessories", "Fragrance"]) },
  { slug: "catellani-smith", name: "Catellani & Smith", category: "Lighting", country: "Italy", mark: { text: "Catellani & Smith", className: "font-serif text-[22px]" }, collections: collections(["Pendant", "Wall", "Table", "Outdoor"]) },
  { slug: "flos", name: "Flos", category: "Lighting", country: "Italy", mark: { text: "FLOS", className: "font-serif text-[40px] tracking-[0.02em]" }, collections: collections(["Decorative", "Architectural", "Outdoor", "Systems"]) },
  { slug: "areti", name: "Areti", category: "Lighting", country: "Germany", mark: { text: "ARETI", className: "text-[32px] tracking-[0.35em]" }, collections: collections(["Pendant", "Wall", "Floor", "Table"]) },
  { slug: "vibia", name: "Vibia", category: "Lighting", country: "Spain", mark: { text: "VIBIA", className: "text-[32px] tracking-[0.3em]" }, collections: collections(["Indoor", "Outdoor", "Systems", "Collections"]) },
  { slug: "deltalight", name: "Delta Light", category: "Architectural lighting", country: "Belgium", mark: { text: "⌧ DELTALIGHT", className: "text-[22px] tracking-[0.02em]" }, collections: collections(["Recessed", "Surface", "Profiles", "Outdoor"]) },
  { slug: "pedrali", name: "Pedrali", category: "Furniture", country: "Italy", mark: { text: "pedrali", className: "font-semibold text-[34px] tracking-[-0.04em]" }, collections: collections(["Chairs", "Tables", "Lounge", "Outdoor"]) },
];

export function getBrand(slug: string): Brand | undefined {
  return BRANDS.find((b) => b.slug === slug);
}
