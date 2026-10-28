import sharp from "sharp";
import { extractImages, getDocumentProxy, getResolvedPDFJS } from "unpdf";

/**
 * Reads a supplier's *presentation catalogue* PDF: one product family per page (or per column),
 * printed as a large title, a type line ("Wall lamp", "Pendant lamp"), "Materials:", "Colours:",
 * "Light source:" lines, a few dimensions and photos. There are no prices and no article numbers;
 * those come from the price list. The families found here lend their photos and specifications to
 * the price-list products of the same family.
 */

export type FamilyBlock = {
  family: string;
  type: string;
  materials: string;
  colours: string;
  lightSource: string;
  dimensions: string;
  notes: string;
  /** the chapter the page belongs to ("Lederam"), from the last title-only page */
  section: string;
  page: number;
  /** JPEG data URLs, max 560 px */
  images: string[];
};

type Line = { y: number; x0: number; x1: number; size: number; text: string; items: { x: number; size: number; text: string }[] };

const TITLE_MIN_SIZE = 10;
const TYPE_RE = /\b(lamp|lamps|light|lights|chandelier|luminaire|candle holder|holder|spot|bollard|sofa|armchair|chair|stool|table|desk|bed|shelf|cabinet|sideboard|mirror|rug|vase|bench)\b/i;
const LABEL_RE = /^(materials?(?: and colou?rs)?|colou?rs?|light sources?|finish(?:es)?|dimensions?|sizes?)\s*:/i;
const SIZE_RE = /(?:Ø\s*)?\d+(?:[.,]\d+)?(?:\s*\/\s*\d+(?:[.,]\d+)?)*\s*(?:x\s*\d+(?:[.,]\d+)?(?:\s*\/\s*\d+)*\s*)*(?:cm|mm|m)\b(?:\s*ca\.?)?/gi;
const NOISE_RE = /^(awarded with|project by|photo by|ph\. by|custom|design(ed)? by|©|\d+\s*$)/i;
/** The glyphs of a font without a Unicode map come out shifted by 25: "4H[LYPHSZ" is "Materials". */
const GARBLED_RE = /\u0003|[\u0004-\u001f]|\[|\]|\^|\bÄ|\bÅ/;

export function fixGlyphs(s: string): string {
  if (!GARBLED_RE.test(s)) return s;
  const out = [...s]
    .map((ch) => {
      const c = ch.charCodeAt(0);
      if (c === 3 || c === 32) return " ";
      if (c >= 4 && c <= 101) return String.fromCharCode(c + 25);
      return ch;
    })
    .join("")
    .replace(/Ä/g, "fi")
    .replace(/Å/g, "fl")
    .replace(/Ɉ/g, "ff")
    .replace(/Ȭ/g, "ō");
  // keep the decoded text only when it reads like words
  return /[aeiou]{1}/i.test(out) && (out.match(/[a-z]/gi)?.length ?? 0) > out.length * 0.5 ? out : s;
}

const isReadable = (s: string) => {
  const letters = s.match(/[A-Za-z\u00C0-\u024F\d]/g)?.length ?? 0;
  const odd = s.match(/[\[\]^"#$%&*=+<>?@|~\u0000-\u001f\u01C0-\u01C3]/g)?.length ?? 0;
  const parens = (s.match(/\(/g)?.length ?? 0) !== (s.match(/\)/g)?.length ?? 0);
  return letters >= s.replace(/[\s.!'’-]/g, "").length * 0.8 && odd === 0 && !parens;
};
/** Captions printed next to the specification ("project by …", "photo by …") are cut off. */
const CAPTION_RE = /\s*\b(project by|photo by|ph\. by|photos? by|designer|designed by|architect|custom project|private residence|showroom)\b.*$/i;

function dims(text: string): string[] {
  return [...text.matchAll(SIZE_RE)].map((m) => m[0].replace(/\s+/g, " ").trim()).filter((d) => /[1-9]/.test(d) && !/^0\s*(cm|mm|m)$/i.test(d));
}

async function pageLines(page: Awaited<ReturnType<Awaited<ReturnType<typeof getDocumentProxy>>["getPage"]>>): Promise<Line[]> {
  const pageHeight = page.view[3] - page.view[1];
  const content = await page.getTextContent();
  type Item = { str: string; transform: number[]; width: number };
  const rows = new Map<number, { x: number; w: number; size: number; text: string }[]>();
  for (const it of content.items as Item[]) {
    if (typeof it.str !== "string" || !it.str.trim()) continue;
    const y = Math.round(pageHeight - it.transform[5]);
    const key = [...rows.keys()].find((k) => Math.abs(k - y) <= 2) ?? y;
    rows.set(key, [...(rows.get(key) ?? []), { x: it.transform[4], w: it.width || 0, size: Math.abs(it.transform[0]) || Math.abs(it.transform[1]) || 0, text: it.str }]);
  }
  const lines: Line[] = [];
  for (const [y, its] of [...rows.entries()].sort((a, b) => a[0] - b[0])) {
    its.sort((a, b) => a.x - b.x);
    lines.push({
      y,
      x0: its[0].x,
      x1: Math.max(...its.map((i) => i.x + i.w)),
      size: Math.max(...its.map((i) => i.size)),
      text: its.map((i) => i.text).join(" ").replace(/\s+/g, " ").trim(),
      items: its.map((i) => ({ x: i.x, size: i.size, text: i.text })),
    });
  }
  return lines;
}

/** A title line printed over two columns ("Lederam C2      Lederam WF") splits at the large gap. */
function splitColumns(line: Line): { x: number; text: string }[] {
  const parts: { x: number; text: string }[] = [];
  let cur: { x: number; text: string } | null = null;
  let lastEnd = -1;
  for (const it of line.items) {
    const gap = lastEnd < 0 ? 0 : it.x - lastEnd;
    if (!cur || gap > 60) {
      cur = { x: it.x, text: it.text };
      parts.push(cur);
    } else cur.text += ` ${it.text}`;
    lastEnd = it.x + it.text.length * line.size * 0.55;
  }
  return parts.map((p) => ({ x: p.x, text: p.text.replace(/\s+/g, " ").trim() }));
}

/** Text of the lines in one column: items whose x falls inside [x0, x1). */
function columnText(line: Line, x0: number, x1: number): string {
  return line.items
    .filter((i) => i.x >= x0 && i.x < x1)
    .map((i) => i.text)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

type IndexEntry = { family: string; hint: string; printed: number };

/**
 * "Lederam W 123" entries of an A–Z index page. An entry ends at a page number that is followed by
 * the next entry's name (a capitalised word) or the end of the line, so names with numbers
 * ("Par 18 61", "Lederam C180 / C150 119", "PostKrisi 50 / 51 / 52 176") stay whole.
 */
function parseIndex(lines: Line[]): IndexEntry[] {
  const out: IndexEntry[] = [];
  for (const l of lines) {
    if (l.size > 11 || /\bindex\b/i.test(l.text)) continue;
    const toks = l.text.split(/\s+/);
    let name: string[] = [];
    let depth = 0;
    for (const [i, t] of toks.entries()) {
      depth += (t.match(/\(/g)?.length ?? 0) - (t.match(/\)/g)?.length ?? 0);
      const next = toks[i + 1];
      const endsEntry = /^\d{1,4}$/.test(t) && depth <= 0 && name.length > 0 && (next === undefined || /^[A-ZÀ-Ý]/.test(next));
      if (endsEntry) {
        const raw = name.join(" ").trim();
        const hint = raw.match(/\(([^)]*)\)/)?.[1] ?? "";
        const family = raw.replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ").trim();
        if (family.length >= 2) out.push({ family, hint, printed: Number(t) });
        name = [];
      } else name.push(t);
    }
  }
  return out;
}

const typeWords = (s: string) => new Set((s.toLowerCase().match(/[a-z]+/g) ?? []).filter((w) => w.length > 2 && !["lamp", "lamps", "with", "and", "for", "the"].includes(w)));

export async function extractCatalogueFamilies(data: ArrayBuffer, opts: { withImages?: boolean; maxImagesPerFamily?: number } = {}): Promise<{ blocks: FamilyBlock[]; pages: number }> {
  const withImages = opts.withImages ?? true;
  const maxImages = opts.maxImagesPerFamily ?? 3;
  const pdf = await getDocumentProxy(new Uint8Array(data));
  const pdfjs = await getResolvedPDFJS();
  const OPS = pdfjs.OPS;
  const blocks: FamilyBlock[] = [];
  const index: IndexEntry[] = [];
  const printedPages = new Map<number, number[]>(); // pdf page → printed numbers
  let section = "";
  type Pending = { block: FamilyBlock; x0: number; x1: number; garbled: boolean };
  const pending: { page: number; cols: Pending[] }[] = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const pageWidth = page.view[2] - page.view[0];
    const lines = await pageLines(page);
    if (lines.some((l) => /\bindex\b/i.test(l.text) && l.size >= 8)) index.push(...parseIndex(lines));
    // printed page numbers: small numeric lines ("117", "120 121")
    // printed page numbers: small stand-alone numbers at the top or bottom edge ("117", "120 121"), left to right
    const pageHeight = page.view[3] - page.view[1];
    const nums = lines
      .filter((l) => l.y > pageHeight * 0.8 || l.y < pageHeight * 0.12)
      .flatMap((l) => l.items.filter((i) => i.size <= 8 && /^\d{1,4}$/.test(i.text)).map((i) => ({ x: i.x, n: Number(i.text) })))
      .sort((a, b) => a.x - b.x)
      .map((i) => i.n);
    if (nums.length) printedPages.set(p, nums);

    const titles = lines.filter((l) => l.size >= TITLE_MIN_SIZE && l.text.length < 70 && l.text.length >= 2 && !/^\d+$/.test(l.text));
    if (!titles.length) continue;
    // columns from the first title line that has several parts
    const titleLine = titles[0];
    const parts = splitColumns(titleLine);
    const colBounds = parts.map((pt, i) => ({ x0: i === 0 ? 0 : (parts[i - 1].x + pt.x) / 2, x1: i + 1 < parts.length ? (pt.x + parts[i + 1].x) / 2 : pageWidth, title: pt.text }));
    const below = lines.filter((l) => l.y > titleLine.y);
    const cols: Pending[] = [];
    for (const col of colBounds) {
      const texts = below.map((l) => fixGlyphs(columnText(l, col.x0, col.x1)).replace(CAPTION_RE, "").trim()).filter(Boolean);
      const typeIdx = texts.findIndex((t) => TYPE_RE.test(t) && !LABEL_RE.test(t) && t.length < 60 && !/[’'].s\b|\bthe\b|\bil\b|\bdel\b/i.test(t));
      if (typeIdx < 0 || col.title.length > 45) continue;
      const typeLine = texts[typeIdx];
      const type = typeLine.replace(SIZE_RE, "").replace(/\b(mod\.\s*\S+|max|H not|adjustable|variable)\b/gi, "").replace(/\s+/g, " ").trim();
      const fields: Record<string, string[]> = { materials: [], colours: [], lightSource: [], notes: [] };
      let current: keyof typeof fields | null = null;
      const allDims = new Set<string>(dims(typeLine));
      for (const t of texts.slice(typeIdx + 1)) {
        if (NOISE_RE.test(t) || /^\d{1,4}(\s+\d{1,4})?$/.test(t)) {
          current = null;
          continue;
        }
        for (const d of dims(t)) allDims.add(d);
        const label = t.match(LABEL_RE)?.[1]?.toLowerCase();
        const body = t.replace(LABEL_RE, "").replace(/\s+/g, " ").trim();
        if (label) {
          current = /material/.test(label) ? "materials" : /colou?r/.test(label) ? "colours" : /light/.test(label) ? "lightSource" : "notes";
          if (body) fields[current].push(body);
        } else if (/^(further|available|custom|also|on request)/i.test(t)) {
          fields.notes.push(t.replace(/\s+/g, " ").trim());
          current = null;
        } else if (current && body && !TYPE_RE.test(t)) {
          fields[current].push(body);
        }
      }
      const join = (a: string[]) => a.join(" ").replace(/\s+([,;.])/g, "$1").replace(/[,;]\s*$/, "").trim();
      const title = col.title.replace(/\s+\d[\d/,. ]*\s*(cm|mm|m)\b.*$/i, "").trim();
      const garbled = !isReadable(title);
      cols.push({
        block: { family: garbled ? "" : title, type, materials: join(fields.materials), colours: join(fields.colours), lightSource: join(fields.lightSource), dimensions: [...allDims].join(", "), notes: join(fields.notes), section, page: p, images: [] },
        x0: col.x0,
        x1: col.x1,
        garbled,
      });
    }
    if (!cols.length) {
      // a title without a product: the chapter name ("Lederam", "PostKrisi")
      if (parts.length === 1 && isReadable(parts[0].text) && !/^\d/.test(parts[0].text)) section = parts[0].text.replace(/\s+\d[\d/,. ]*\s*(cm|mm|m)\b.*$/i, "").trim();
      continue;
    }

    if (withImages) {
      // image positions (centre x, y) from the operator list, then the decoded images in the same order
      const ops = await page.getOperatorList();
      const positions: { x: number; y: number }[] = [];
      let ctm = [1, 0, 0, 1, 0, 0];
      const stack: number[][] = [];
      for (let i = 0; i < ops.fnArray.length; i++) {
        const fn = ops.fnArray[i];
        const args = ops.argsArray[i] as number[];
        if (fn === OPS.save) stack.push(ctm);
        else if (fn === OPS.restore) ctm = stack.pop() ?? ctm;
        else if (fn === OPS.transform) ctm = mul(ctm, args);
        else if (fn === OPS.paintImageXObject || fn === OPS.paintInlineImageXObject) positions.push({ x: ctm[0] * 0.5 + ctm[2] * 0.5 + ctm[4], y: ctm[1] * 0.5 + ctm[3] * 0.5 + ctm[5] });
      }
      let extracted: Awaited<ReturnType<typeof extractImages>> = [];
      try {
        extracted = await extractImages(pdf, p);
      } catch {
        extracted = [];
      }
      for (const [n, img] of extracted.entries()) {
        if (img.width < 300 || img.height < 300) continue;
        const pos = positions[n];
        const col = pos && cols.length > 1 ? cols.find((c) => pos.x >= c.x0 && pos.x < c.x1) ?? cols[0] : cols[0];
        if (col.block.images.length >= maxImages) continue;
        const url = await toJpegDataUrl(img.data, img.width, img.height, img.channels);
        if (url) col.block.images.push(url);
      }
    }
    pending.push({ page: p, cols });
  }

  // names for garbled titles: the index entry printed on the same page, else the chapter + type
  for (const { page, cols } of pending) {
    for (const [k, c] of cols.entries()) {
      if (!c.garbled) continue;
      const printed = printedPages.get(page) ?? [];
      // a spread prints two numbers: the left column belongs to the left number
      const own = printed.length === cols.length ? printed[k] : null;
      const candidates = index.filter((e) => printed.some((n) => Math.abs(n - e.printed) <= 1));
      let best: IndexEntry | null = null;
      let bestScore = -1;
      for (const e of candidates) {
        const tw = typeWords(c.block.type);
        const hw = typeWords(e.hint);
        const score = [...hw].filter((w) => tw.has(w)).length + (e.printed === own ? 2 : printed.includes(e.printed) ? 1 : 0.5);
        if (score > bestScore) {
          best = e;
          bestScore = score;
        }
      }
      c.block.family = best ? best.family : `${c.block.section} ${c.block.type}`.trim();
    }
    blocks.push(...cols.map((c) => c.block).filter((b) => b.family));
  }
  return { blocks, pages: pdf.numPages };
}

function mul(m: number[], t: number[]): number[] {
  return [t[0] * m[0] + t[1] * m[2], t[0] * m[1] + t[1] * m[3], t[2] * m[0] + t[3] * m[2], t[2] * m[1] + t[3] * m[3], t[4] * m[0] + t[5] * m[2] + m[4], t[4] * m[1] + t[5] * m[3] + m[5]];
}

async function toJpegDataUrl(data: Uint8ClampedArray, width: number, height: number, channels: 1 | 3 | 4): Promise<string | null> {
  try {
    const buf = await sharp(Buffer.from(data.buffer, data.byteOffset, data.byteLength), { raw: { width, height, channels } })
      .flatten({ background: "#ffffff" })
      .resize({ width: 560, height: 560, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 78 })
      .toBuffer();
    return `data:image/jpeg;base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** "Lederam C180 / C150" → ["lederam c180", "lederam c150"]; "PostKrisi 50 / 51 / 52" → three names. */
export function familyAliases(family: string): string[] {
  const parts = family.split(/\s*\/\s*/).map((p) => p.trim()).filter(Boolean);
  if (parts.length <= 1) return [norm(family)];
  const head = parts[0];
  const prefix = head.replace(/\S+$/, "").trim();
  return parts.map((p, i) => norm(i === 0 || /\s/.test(p) ? p : `${prefix} ${p}`));
}

/** The catalogue family for a price-list product: same family name, and the closest type when several pages share it. */
export function findFamily(blocks: FamilyBlock[], family: string, type: string): FamilyBlock | null {
  const f = norm(family);
  if (!f) return null;
  const sameName = blocks.filter((b) => familyAliases(b.family).includes(f));
  if (!sameName.length) return null;
  if (sameName.length === 1) return sameName[0];
  const tw = typeWords(type);
  let best = sameName[0];
  let bestScore = -1;
  for (const b of sameName) {
    const bw = typeWords(b.type);
    const common = [...bw].filter((w) => tw.has(w)).length;
    const score = common * 2 - Math.abs(bw.size - tw.size) * 0.1;
    if (score > bestScore) {
      best = b;
      bestScore = score;
    }
  }
  return best;
}
