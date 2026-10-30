import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { PDFDocument } from "pdf-lib";
import { getDocumentProxy } from "unpdf";
import { z } from "zod";
import { aiEnabled } from "@/lib/ai";
import type { BlockRow } from "@/lib/pricelist-blocks";
import { familyPhotos } from "@/lib/pdf-images";

/**
 * AI reading of a supplier PDF of any layout (price list, catalogue with prices, product sheets):
 * the PDF is cut into chunks of a few pages and Claude reads each chunk as a document (text and
 * page images), returning one entry per sellable product with its code, price, variant and
 * specifications. The chunks are read in parallel; the photos are taken from the PDF itself.
 */

const MODEL = "claude-opus-5-5";
/** All chunks are read at once so a long document still fits in the import's time limit. */
const MAX_CHUNKS = 16;
const MIN_CHUNK_PAGES = 6;
/** The API takes requests up to 32 MB: heavier chunks are split again. */
const MAX_CHUNK_BYTES = 22 * 1024 * 1024;
/** Stop waiting before the import's 300 s limit and keep what was read. */
const DEADLINE_MS = 250_000;

const Spec = z.object({ label: z.string(), value: z.string() });
const Product = z.object({
  family: z.string().describe("Product family / model name as printed, e.g. 'Farooo', 'Filigree Floor Lamp'"),
  designer: z.string().describe("Designer name, empty if not printed"),
  type: z.string().describe("What the product is, singular, in English, e.g. 'floor lamp', 'dining chair'"),
  variant: z.string().describe("What distinguishes this item from the others of the family: size / colour / finish words, e.g. 'large / white'. Empty if the family has one item"),
  sku: z.string().describe("Article code exactly as printed. For a set sold as one product (parts + 'complete' price) join the part codes with '+'. Empty if none"),
  price: z.number().describe("Price of this product as printed (for a set the 'complete' / total price), as a plain number, e.g. 3053 for '€ 3.053'. 0 if no price"),
  currency: z.string().describe("ISO code, e.g. EUR"),
  description: z.string().describe("The family's introduction text as printed (may be shared by all items of the family); empty if none"),
  materials: z.string(),
  dimensions: z.string().describe("Dimensions as printed"),
  lightSource: z.string().describe("Lamp holder / light source / wattage, empty if not a lamp"),
  specs: z.array(Spec).describe("All other technical lines printed for this item, label and value"),
  page: z.number().int().describe("Page number (of the whole document) where this item's price line is printed"),
  photoPage: z.number().int().describe("Page number where the family's product photo is printed; 0 if none"),
});
const Extraction = z.object({ products: z.array(Product) });
export type AiCatalogueProduct = z.infer<typeof Product>;

let client: Anthropic | null = null;
const getClient = () => (client ??= new Anthropic({ maxRetries: 3 }));

const SYSTEM =
  "You read PDF documents from furniture and lighting suppliers (price lists, catalogues with prices, product sheets) and list " +
  "every sellable product in them as structured data. Layouts vary a lot; read the pages like a person would. " +
  "Rules: one entry per orderable item (one size / colour / finish with its own code or price). When parts are listed with a 'complete' " +
  "or total price, that set is ONE product priced at the total, with the part codes joined by '+'. Accessories and spare parts that are " +
  "listed with their own code and price are separate products. Copy codes, prices, dimensions and specifications exactly as printed; " +
  "never invent or convert values. Ignore covers, indexes, terms and conditions.";

async function readChunk(pdf: PDFDocument, from: number, to: number, total: number, brand: string, signal: AbortSignal): Promise<AiCatalogueProduct[]> {
  // one page of context before the chunk, so a family that started on the previous page keeps its name
  const start = Math.max(1, from - 1);
  const part = await PDFDocument.create();
  const pages = await part.copyPages(pdf, Array.from({ length: to - start + 1 }, (_, i) => start - 1 + i));
  for (const pg of pages) part.addPage(pg);
  const bytes = await part.save();
  if (bytes.length > MAX_CHUNK_BYTES && to > from) {
    const mid = Math.floor((from + to) / 2);
    const halves = await Promise.all([readChunk(pdf, from, mid, total, brand, signal), readChunk(pdf, mid + 1, to, total, brand, signal)]);
    return halves.flat();
  }
  const data = Buffer.from(bytes).toString("base64");
  const stream = getClient().messages.stream({
    model: MODEL,
    max_tokens: 32000,
    thinking: { type: "adaptive" },
    output_config: { effort: "low", format: zodOutputFormat(Extraction) },
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: [
          { type: "document", source: { type: "base64", media_type: "application/pdf", data } },
          {
            type: "text",
            text:
              `These are pages ${start}–${to} of a ${total}-page document${brand ? ` from ${brand}` : ""}. Use these page numbers in "page" and "photoPage" ` +
              `(the first page of this excerpt is page ${start}). ` +
              (start < from ? `Page ${start} is only context: list products whose price line is on pages ${from}–${to}.` : `List every product on these pages.`),
          },
        ],
      },
    ],
  }, { signal });
  const msg = await stream.finalMessage();
  return (msg.parsed_output?.products ?? []).filter((p) => p.page >= from && p.page <= to);
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    })
  );
  return out;
}

/** Reads the PDF with Claude. Returns the products as price-list rows (with photos) for the import wizard. */
export async function readCatalogueWithAI(data: ArrayBuffer, brand: string): Promise<{ rows: BlockRow[]; pages: number; failed: number; chunks: number; currency: string }> {
  if (!aiEnabled()) return { rows: [], pages: 0, failed: 0, chunks: 0, currency: "" };
  const pdf = await PDFDocument.load(data.slice(0), { ignoreEncryption: true });
  const total = pdf.getPageCount();
  const size = Math.max(MIN_CHUNK_PAGES, Math.ceil(total / MAX_CHUNKS));
  const chunks: [number, number][] = [];
  for (let p = 1; p <= total; p += size) chunks.push([p, Math.min(total, p + size - 1)]);
  let failed = 0;
  const signal = AbortSignal.timeout(DEADLINE_MS);
  const results = await mapLimit(chunks, MAX_CHUNKS, ([from, to]) =>
    readChunk(pdf, from, to, total, brand, signal).catch((e: unknown) => {
      failed++;
      console.error(`AI catalogue chunk ${from}-${to} failed`, e);
      return [] as AiCatalogueProduct[];
    })
  );
  const products = results.flat();

  // the family descriptions are often printed once: share them within the family
  const intro = new Map<string, string>();
  for (const p of products) if (p.description && !intro.has(p.family.toLowerCase())) intro.set(p.family.toLowerCase(), p.description);

  // photos: those on each family's photo page, shared out between the families shown on that page
  const famsByPage = new Map<number, string[]>();
  for (const p of products) {
    if (p.photoPage < 1 || p.photoPage > total) continue;
    const list = famsByPage.get(p.photoPage) ?? [];
    if (!list.includes(p.family)) list.push(p.family);
    famsByPage.set(p.photoPage, list);
  }
  const photos = new Map<string, string[]>();
  if (famsByPage.size) {
    const doc = await getDocumentProxy(new Uint8Array(data.slice(0)));
    await mapLimit([...famsByPage.entries()], 4, async ([page, fams]) => {
      for (const f of fams) {
        const imgs = await familyPhotos(doc, page, { name: f }).catch(() => [] as string[]);
        if (imgs.length) photos.set(f, imgs);
      }
    });
  }

  const currencies = new Map<string, number>();
  for (const p of products) if (p.currency) currencies.set(p.currency.toUpperCase(), (currencies.get(p.currency.toUpperCase()) ?? 0) + 1);
  const seen = new Set<string>();
  const rows: BlockRow[] = [];
  for (const p of products) {
    const key = p.sku ? p.sku : `${p.family}|${p.variant}|${p.price}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const description = p.description || intro.get(p.family.toLowerCase()) || "";
    const specText = p.specs.map((s) => `${s.label}: ${s.value}`).join("\n");
    rows.push({
      sku: p.sku.trim(),
      family: p.family.trim(),
      type: p.type.trim(),
      desc: [p.variant, p.materials, p.lightSource].filter(Boolean).join(" / "),
      price: p.price > 0 ? p.price : 0,
      page: p.page,
      variant: p.variant.trim(),
      spec: [description, specText, p.materials && `Materials: ${p.materials}`, p.lightSource && `Light source: ${p.lightSource}`, p.dimensions && `Dimensions: ${p.dimensions}`].filter(Boolean).join("\n\n"),
      designer: p.designer,
      finish: p.variant,
      materials: p.materials,
      lightSource: p.lightSource,
      weight: p.specs.find((s) => /weight|peso|gewicht/i.test(s.label))?.value ?? "",
      dimensions: p.dimensions,
      images: photos.get(p.family) ?? [],
    });
  }
  const currency = [...currencies.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
  return { rows, pages: total, failed, chunks: chunks.length, currency };
}
