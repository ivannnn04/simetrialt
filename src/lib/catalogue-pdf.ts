import sharp from "sharp";
import { extractImages, getDocumentProxy, getResolvedPDFJS } from "unpdf";

/**
 * Reads a supplier PDF catalogue into product blocks: the text that belongs to each product
 * (name, description, specification lines) and the photo printed next to it.
 *
 * Products are anchored on their SKU. When a price list is supplied its SKUs are searched in the
 * text; otherwise lines that look like article numbers are used. Photos are matched to products by
 * their vertical position on the page, falling back to order of appearance.
 */

export type PdfLine = { text: string; y: number; page: number; /** font size of the largest item */ size: number };
export type PdfImage = { page: number; y: number; /** JPEG data URL, max 640 px */ dataUrl: string; width: number; height: number };

export type PdfProduct = {
  sku: string;
  page: number;
  /** Lines above the SKU line that are not specification fields (name, short description). */
  header: string[];
  /** Section heading printed above the product (larger font), e.g. "Sofas". */
  heading: string;
  /** Everything from the SKU line down to the next product. */
  body: string[];
  images: PdfImage[];
};

const MIN_IMAGE_PX = 110; // skip logos, icons and separators

/** Labels that mark a specification line (EN / LT / IT / DE). Anything else above the SKU is header text. */
const LABEL_RE =
  /^(art\.?\s*no\.?|article|artikel|sku|code|kodas|codice|ref\.?|type|tipas|tipologia|colou?r|spalva|colore|dimensions?|matmenys|dimensioni|size|dydis|weight|svoris|peso|materials?|medžiaga|medziaga|materiale|finish|apdaila|price|kaina|prezzo|rrp|net|brand|gamintojas|collection|kolekcija|designer|dizaineris|w\s|h\s|d\s|ø)/i;
const PRICE_RE = /(€|eur|\$|£)\s?\d|\d[\d.,]*\s?(€|eur)/i;
/** "Art. no. 294.431.47", "SKU: AB-1234", "Kodas 10233" – the token must contain a digit. */
const SKU_LABEL_RE = /\b(art\.?\s*no\.?|article\s*(?:no\.?|number)?|artikel|sku|code|kodas|codice|ref\.?|item\s*no\.?)\s*[:#.]?\s*((?=[A-Z0-9.\-/]*\d)[A-Z0-9][A-Z0-9.\-/]{3,})/i;

export async function extractPdfPages(data: ArrayBuffer): Promise<{ lines: PdfLine[]; images: PdfImage[]; pages: number }> {
  const pdf = await getDocumentProxy(new Uint8Array(data));
  const pdfjs = await getResolvedPDFJS();
  const OPS = pdfjs.OPS;
  const lines: PdfLine[] = [];
  const images: PdfImage[] = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const pageHeight = page.view[3] - page.view[1];

    // --- text, grouped into lines by baseline ---
    const content = await page.getTextContent();
    type Item = { str: string; transform: number[]; width: number };
    const items = (content.items as Item[]).filter((it) => typeof it.str === "string");
    const rows = new Map<number, Item[]>();
    for (const it of items) {
      const y = Math.round(pageHeight - it.transform[5]); // top-down coordinates
      const key = [...rows.keys()].find((k) => Math.abs(k - y) <= 2) ?? y;
      rows.set(key, [...(rows.get(key) ?? []), it]);
    }
    for (const [y, its] of [...rows.entries()].sort((a, b) => a[0] - b[0])) {
      const text = its
        .sort((a, b) => a.transform[4] - b.transform[4])
        .map((it) => it.str)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      const size = Math.max(...its.map((it) => Math.abs(it.transform[0]) || Math.abs(it.transform[1]) || 0));
      if (text) lines.push({ text, y, page: p, size });
    }

    // --- image positions: walk the operator list tracking the CTM ---
    const ops = await page.getOperatorList();
    const positions: number[] = [];
    let ctm = [1, 0, 0, 1, 0, 0];
    const stack: number[][] = [];
    for (let i = 0; i < ops.fnArray.length; i++) {
      const fn = ops.fnArray[i];
      const args = ops.argsArray[i] as number[];
      if (fn === OPS.save) stack.push(ctm);
      else if (fn === OPS.restore) ctm = stack.pop() ?? ctm;
      else if (fn === OPS.transform) ctm = mul(ctm, args);
      else if (fn === OPS.paintImageXObject || fn === OPS.paintInlineImageXObject) {
        // image space is the unit square; its centre is (0.5, 0.5)
        const cy = ctm[1] * 0.5 + ctm[3] * 0.5 + ctm[5];
        positions.push(Math.round(pageHeight - cy));
      }
    }

    let extracted: Awaited<ReturnType<typeof extractImages>> = [];
    try {
      extracted = await extractImages(pdf, p);
    } catch {
      extracted = [];
    }
    let n = 0;
    for (const img of extracted) {
      const y = positions[n] ?? -1;
      n++;
      if (img.width < MIN_IMAGE_PX || img.height < MIN_IMAGE_PX) continue;
      const dataUrl = await toJpegDataUrl(img.data, img.width, img.height, img.channels);
      if (dataUrl) images.push({ page: p, y, dataUrl, width: img.width, height: img.height });
    }
  }
  return { lines, images, pages: pdf.numPages };
}

function mul(m: number[], t: number[]): number[] {
  return [
    t[0] * m[0] + t[1] * m[2],
    t[0] * m[1] + t[1] * m[3],
    t[2] * m[0] + t[3] * m[2],
    t[2] * m[1] + t[3] * m[3],
    t[4] * m[0] + t[5] * m[2] + m[4],
    t[4] * m[1] + t[5] * m[3] + m[5],
  ];
}

async function toJpegDataUrl(data: Uint8ClampedArray, width: number, height: number, channels: 1 | 3 | 4): Promise<string | null> {
  try {
    const buf = await sharp(Buffer.from(data.buffer, data.byteOffset, data.byteLength), { raw: { width, height, channels } })
      .flatten({ background: "#ffffff" })
      .resize({ width: 640, height: 640, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 82 })
      .toBuffer();
    return `data:image/jpeg;base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

const isLabel = (s: string) => LABEL_RE.test(s) || PRICE_RE.test(s);
const CATEGORY_WORD_RE =
  /^(sofas?|armchairs?|chairs?|tables?|lighting|lamps?|storage|beds?|desks?|outdoor|accessories|rugs?|textiles?|mirrors?|shelv(es|ing)|cabinets?|wardrobes?|sofos|kėdės|stalai|šviestuvai|apšvietimas|lovos|spintos|lentynos|divani|sedie|tavoli|illuminazione|letti|contenitori)\b/i;

/** Splits the page lines into products anchored on SKUs. */
export function splitProducts(lines: PdfLine[], images: PdfImage[], knownSkus: string[]): PdfProduct[] {
  const known = knownSkus.filter(Boolean).map((s) => s.trim());
  const anchors: { idx: number; sku: string }[] = [];
  const seen = new Set<string>();
  for (const [i, l] of lines.entries()) {
    let sku: string | null = null;
    if (known.length) {
      const hit = known.find((s) => l.text.includes(s));
      if (hit) sku = hit;
    } else {
      const m = l.text.match(SKU_LABEL_RE);
      if (m) sku = m[2];
    }
    if (sku && !seen.has(sku)) {
      seen.add(sku);
      anchors.push({ idx: i, sku });
    }
  }

  const products: PdfProduct[] = [];
  let lastHeading = "";
  for (const [k, a] of anchors.entries()) {
    const prevEnd = k > 0 ? anchors[k - 1].idx : -1;
    const nextIdx = k + 1 < anchors.length ? anchors[k + 1].idx : lines.length;
    const page = lines[a.idx].page;
    // header: up to 4 non-specification lines directly above the SKU line, same page
    const headerLines: PdfLine[] = [];
    for (let i = a.idx - 1; i > prevEnd && headerLines.length < 4; i--) {
      const l = lines[i];
      if (l.page !== page || isLabel(l.text)) break;
      headerLines.unshift(l);
    }
    // A section heading ("Sofas") is set larger than the product name below it. Names are also
    // larger than descriptions, so a bigger first line counts as a heading only when a name and
    // a description follow it, or when it reads like a category.
    if (
      headerLines.length >= 2 &&
      headerLines[0].size > headerLines[1].size * 1.25 &&
      (headerLines.length >= 3 || CATEGORY_WORD_RE.test(headerLines[0].text))
    ) {
      lastHeading = headerLines.shift()!.text;
    }
    const header = headerLines.map((l) => l.text);
    // body: from the SKU line to the line before the next product's header
    const body: string[] = [];
    let bodyEnd = nextIdx;
    if (k + 1 < anchors.length) {
      // the next product's header lines sit just above its SKU line: exclude them
      let i = nextIdx - 1;
      let count = 0;
      while (i > a.idx && lines[i].page === lines[nextIdx].page && !isLabel(lines[i].text) && count < 4) {
        i--;
        count++;
      }
      bodyEnd = i + 1;
    }
    for (let i = a.idx; i < bodyEnd; i++) {
      if (lines[i].page !== page) break;
      body.push(lines[i].text);
    }
    products.push({ sku: a.sku, page, header, heading: lastHeading, body, images: [] });
  }

  // images → products by vertical position on the same page, else by order
  for (const pageNo of new Set(products.map((p) => p.page))) {
    const ps = products.filter((p) => p.page === pageNo);
    const imgs = images.filter((im) => im.page === pageNo);
    const anchorY = (p: PdfProduct) => lines[anchors.find((a) => a.sku === p.sku)!.idx].y;
    for (const [n, im] of imgs.entries()) {
      let target: PdfProduct | undefined;
      if (im.y >= 0) {
        // the product whose block spans the image centre, else the nearest SKU line
        target = ps.reduce<PdfProduct | undefined>((best, p) => {
          const d = Math.abs(anchorY(p) - im.y);
          return !best || d < Math.abs(anchorY(best) - im.y) ? p : best;
        }, undefined);
      } else {
        target = ps[n] ?? ps[ps.length - 1];
      }
      target?.images.push(im);
    }
  }
  return products;
}

export type ParsedFields = {
  name: string;
  description: string;
  typology: string;
  colour: string;
  dimensions: string;
  weight: string;
  material: string;
  priceCents: number | null;
};

/** Rule-based reading of a product block; the AI pass (when configured) refines it. */
export function parseFields(p: PdfProduct): ParsedFields {
  const grab = (re: RegExp) => {
    for (const l of p.body) {
      const m = l.match(re);
      if (m) return m[1].trim();
    }
    return "";
  };
  const name = p.header[0] ?? p.sku;
  const description = p.header.slice(1).join(" ");
  const typology = grab(/^(?:type|tipas|tipologia|product type)\s*[:.]?\s*(.+?)(?:\s+[·•|]\s+colou?r.*)?$/i);
  const colour = grab(/(?:colou?r|spalva|colore)\s*[:.]?\s*([^·•|]+)/i);
  const dimensions = grab(/(?:dimensions?|matmenys|dimensioni|size)\s*[:.]?\s*(.+)$/i);
  const weight = grab(/(?:weight|svoris|peso)\s*[:.]?\s*([\d.,]+\s*(?:kg|g|lb)?)/i);
  const material = grab(/(?:materials?|medžiaga|medziaga|materiale)\s*[:.]?\s*(.+)$/i);
  let priceCents: number | null = null;
  for (const l of p.body) {
    const m = l.match(/(?:€|eur)\s*([\d.,]+)|([\d.,]+)\s*(?:€|eur)/i);
    if (m) {
      const raw = (m[1] ?? m[2]).replace(/\.(?=\d{3}\b)/g, "").replace(",", ".");
      const n = Number.parseFloat(raw);
      if (Number.isFinite(n)) {
        priceCents = Math.round(n * 100);
        break;
      }
    }
  }
  return { name, description, typology, colour, dimensions, weight, material, priceCents };
}
