import { db } from "@/lib/db";
import { formatPrice } from "@/lib/slug";
import { splitDescription } from "@/lib/product-page";

/** One product of an inquiry, as the admin shows it (photos, specifications, quantity, note). */
export type LeadProduct = {
  productId: string | null;
  slug: string | null;
  sku: string;
  name: string;
  brand: string;
  category: string;
  typology: string;
  images: string[];
  quantity: number;
  unitCents: number;
  unit: string;
  sum: string;
  note: string;
  description: string;
  details: { title: string; body: string }[];
  /** index into the inquiry's sections (see parseLeadSections); null when it has none */
  section: number | null;
};

/** A section of a collection inquiry (a room, a floor…) with the client's note. */
export type LeadSection = { name: string; note: string };

const SECTION_RE = /^=== (.+) ===$/;
const QUOTE_RE = /^>(?: (.*))?$/;

/**
 * The structure around the products of a collection inquiry: the client's general note ("> " lines
 * before the first section) and the sections, each an "=== name ===" line followed by its "> " note.
 * `starts` are the character offsets of the section headings. Older inquiries have neither.
 */
export function parseLeadSections(message: string): { note: string; sections: LeadSection[]; starts: number[] } {
  const general: string[] = [];
  const sections: { name: string; note: string[] }[] = [];
  const starts: number[] = [];
  let offset = 0;
  for (const line of message.split("\n")) {
    const h = line.match(SECTION_RE);
    const q = line.match(QUOTE_RE);
    if (h) {
      sections.push({ name: h[1].trim(), note: [] });
      starts.push(offset);
    } else if (q) {
      (sections.length ? sections[sections.length - 1].note : general).push(q[1] ?? "");
    }
    offset += line.length + 1;
  }
  return { note: general.join("\n").trim(), sections: sections.map((s) => ({ name: s.name, note: s.note.join("\n").trim() })), starts };
}

/**
 * The products named in an inquiry. A collection inquiry lists them as
 *   "1. Name (Brand)\n   Kodas: SKU · Kiekis: 2 · Kaina: 895,40 €\n   Pastaba: …"
 * (see sendCollectionEnquiry); a product-page inquiry carries one productSku.
 */
export function parseLeadLines(message: string, productSku: string | null): { sku: string; name: string; quantity: number; note: string; section: number | null }[] {
  const out: { sku: string; name: string; quantity: number; note: string; section: number | null }[] = [];
  const { starts } = parseLeadSections(message);
  const re = /^\d+\.\s+(.+)\n\s+Kodas:\s*(.+?)\s+·\s+Kiekis:\s*(\d+)[^\n]*(?:\n\s+Pastaba:\s*(.+))?/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(message))) {
    // the section is the last heading above the product
    let section: number | null = null;
    for (let k = 0; k < starts.length && starts[k] < m.index; k++) section = k;
    out.push({ name: m[1].trim(), sku: m[2].trim() === "—" ? "" : m[2].trim(), quantity: Number(m[3]) || 1, note: (m[4] ?? "").trim(), section });
  }
  if (!out.length && productSku) out.push({ sku: productSku, name: "", quantity: 1, note: "", section: null });
  return out;
}

export async function loadLeadProducts(message: string, productSku: string | null): Promise<LeadProduct[]> {
  const lines = parseLeadLines(message, productSku);
  if (!lines.length) return [];
  const skus = lines.map((l) => l.sku).filter(Boolean);
  const products = await db.product.findMany({
    where: { sku: { in: skus } },
    include: { category: true, images: { orderBy: { sort: "asc" } } },
  });
  const bySku = new Map(products.map((p) => [p.sku ?? "", p]));
  return lines.map((l) => {
    const p = l.sku ? bySku.get(l.sku) : undefined;
    const unitCents = p ? (p.salePriceCents != null && p.salePriceCents < p.priceCents ? p.salePriceCents : p.priceCents) : 0;
    const currency = p?.currency ?? "EUR";
    const split = p ? splitDescription(p.description ?? "", p.material ?? "") : { description: "", details: [] };
    return {
      productId: p?.id ?? null,
      slug: p?.slug ?? null,
      sku: l.sku,
      name: p?.name ?? l.name,
      brand: p?.brand ?? "",
      category: p?.category?.name ?? "",
      typology: p?.typology ?? "",
      images: p?.images.map((i) => i.url) ?? [],
      quantity: l.quantity,
      unitCents,
      unit: unitCents ? formatPrice(unitCents, currency) : "—",
      sum: unitCents ? formatPrice(unitCents * l.quantity, currency) : "—",
      note: l.note,
      description: split.description,
      details: split.details,
      section: l.section,
    };
  });
}
