import { getDocumentProxy } from "unpdf";
import type { BlockRow } from "@/lib/pricelist-blocks";
import { familyPhotos, photosOnPage } from "@/lib/pdf-images";

/**
 * Reads a *sectioned* price list: each product family is printed as a large title, the designer
 * ("MARCEL WANDERS, 2012"), a photo and an introduction, followed by one or more models. A model
 * has a heading ("Model: LARGE", "FAROOO LARGE WHITE"), article lines with the code and the price
 * and, for sets, a "complete" line with the price of the whole set; then a grid of upper-case
 * labels with their values below (MATERIAL DESCRIPTION, LAMPHOLDER, DIMENSIONS…):
 *
 *   Farooo
 *   MARCEL WANDERS, 2012
 *   Model: LARGE
 *   FAROOO LARGE WHITE
 *     Farooo, base L, white          8718282299648      € 1.954   In stock
 *     Farooo, round shade L, white   8718282339962      € 1.099   In stock
 *   complete                                            € 3.053
 *   MATERIAL DESCRIPTION        OUTDOOR USE
 *   Fibreglass base, …          No
 *
 * One product per model: a set becomes one product priced at its "complete" price, with the
 * article codes joined by "+".
 */

type Item = { x: number; y: number; w: number; size: number; text: string };
type Line = { y: number; items: Item[]; text: string; size: number };

type Model = { name: string; header: string; rows: { name: string; code: string; price: number }[]; complete: number | null; specs: [string, string][]; page: number };
type Family = { name: string; designer: string; intro: string[]; section: string; page: number; y: number; until?: number; models: Model[]; images: string[] };

const CODE_RE = /^(?:\d{8,14}|(?=[A-Z0-9.\-/]*\d[A-Z0-9.\-/]*\d[A-Z0-9.\-/]*\d)[A-Z0-9][A-Z0-9.\-/]{4,})$/;
const MONEY_RE = /(?:€|EUR)\s*(\d{1,3}(?:[.,\s]\d{3})*(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)|(\d{1,3}(?:[.,\s]\d{3})*(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)\s*(?:€|EUR)\b/i;
const TOTAL_RE = /^(complete|total|set|komplekt|totale|gesamt)\b/i;
const MODEL_RE = /^(?:model|modello|modell|version)\s*:\s*(.*)$/i;
const DESIGNER_RE = /^[A-ZÀ-Ý][A-ZÀ-Ý .'’\-&/]+(?:,\s*(?:19|20)\d{2})$/;

const isUpper = (s: string) => {
  const letters = s.match(/[A-Za-zÀ-ÿ]/g) ?? [];
  return letters.length >= 3 && letters.every((c) => c === c.toUpperCase());
};
const titleCase = (s: string) => s.toLowerCase().replace(/(^|[\s\-/(])([a-zà-ÿ])/g, (_, pre, ch) => pre + ch.toUpperCase()).trim();
const sentence = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s);
const singular = (section: string) =>
  section
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\b(lamps|lights|luminaires|chandeliers|chairs|tables|sofas|armchairs|stools|benches|mirrors|rugs|vases|cabinets|beds)\b/g, (w) => w.replace(/s$/, ""))
    .trim();

/** "€ 1.954" → 1954, "1.954,50 €" → 1954.5, "€ 775" → 775, "1,099.00" → 1099. */
export function parseMoney(raw: string): number {
  let s = raw.replace(/[€\s]|EUR/gi, "");
  if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  else if (/\.\d{1,2}$/.test(s)) s = s.replace(/,/g, "");
  else s = s.replace(/[.,]/g, "");
  return Number.parseFloat(s);
}

/** Letter-spaced headings come out as "F L O O R" + "L A M P S". */
const unspace = (s: string) => (/^(?:\S ){2,}\S$/.test(s) ? s.replace(/ /g, "") : s);

function toLines(items: Item[]): Line[] {
  const rows: Item[][] = [];
  for (const it of [...items].sort((a, b) => a.y - b.y || a.x - b.x)) {
    const row = rows.find((r) => Math.abs(r[0].y - it.y) <= 2.5);
    if (row) row.push(it);
    else rows.push([it]);
  }
  return rows.map((r) => {
    r.sort((a, b) => a.x - b.x);
    let text = "";
    let end = -1;
    for (const i of r) {
      text += (text && (end < 0 || i.x - end >= 1) ? " " : "") + i.text;
      end = i.x + i.w;
    }
    return { y: r[0].y, items: r, text: text.replace(/\s+/g, " ").trim(), size: Math.max(...r.map((i) => i.size)) };
  });
}

/** An article line: name, code, price (and stock). */
function articleOf(line: Line): { name: string; code: string; price: number } | null {
  const idx = line.items.findIndex((i) => CODE_RE.test(i.text.replace(/\*+$/, "")));
  let code = idx >= 0 ? line.items[idx].text.replace(/\*+$/, "") : "";
  let before = idx >= 0 ? line.items.slice(0, idx).map((i) => i.text).join(" ") : "";
  let after = idx >= 0 ? line.items.slice(idx + 1).map((i) => i.text).join(" ") : "";
  if (!code) {
    // the whole line came as one item: find the code among its words
    const words = line.text.split(" ");
    const w = words.findIndex((x) => CODE_RE.test(x));
    if (w < 0) return null;
    code = words[w];
    before = words.slice(0, w).join(" ");
    after = words.slice(w + 1).join(" ");
  }
  const m = after.match(MONEY_RE);
  if (!m) return null;
  const price = parseMoney(m[1] ?? m[2]);
  if (!Number.isFinite(price) || price <= 0) return null;
  return { name: before.replace(/\s+/g, " ").trim(), code, price };
}

export async function extractSectionPriceList(data: ArrayBuffer, opts: { withImages?: boolean } = {}): Promise<{ rows: BlockRow[]; pages: number; families: number; text: string }> {
  const withImages = opts.withImages ?? true;
  const pdf = await getDocumentProxy(new Uint8Array(data.slice(0)));
  const families: Family[] = [];
  const textParts: string[] = [];

  // body text size: the most common size by characters, over the first pages
  const sizeChars = new Map<number, number>();
  const pagesItems: { items: Item[]; height: number; width: number }[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const height = page.view[3] - page.view[1];
    const width = page.view[2] - page.view[0];
    const content = await page.getTextContent();
    type Raw = { str: string; transform: number[]; width: number };
    const items: Item[] = [];
    for (const it of content.items as Raw[]) {
      if (typeof it.str !== "string" || !it.str.trim()) continue;
      if (Math.abs(it.transform[1]) > Math.abs(it.transform[0])) continue; // rotated text (drawing dimensions)
      const size = Math.round(Math.hypot(it.transform[0], it.transform[1]) * 2) / 2;
      items.push({ x: it.transform[4], y: height - it.transform[5], w: it.width || 0, size, text: unspace(it.str.trim()) });
      if (p <= 20) sizeChars.set(size, (sizeChars.get(size) ?? 0) + it.str.length);
    }
    pagesItems.push({ items, height, width });
    // a document without a single code + price line in its first pages is not this kind of list
    if (p === 20 && !pagesItems.some((pi) => toLines(pi.items).some((l) => articleOf(l)))) return { rows: [], pages: pdf.numPages, families: 0, text: "" };
  }
  const body = [...sizeChars.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 10;

  let family: Family | null = null;
  let model: Model | null = null;
  let section = "";
  let mode: "intro" | "model" | "rows" | "specs" = "intro";
  const titlePages = new Map<number, Family[]>();

  for (const [n, { items, height, width }] of pagesItems.entries()) {
    const p = n + 1;
    const lines = toLines(items);
    if (p <= 3) textParts.push(lines.map((l) => l.text).join(" "));
    // labels and values of the specification grid, resolved per page by column
    const labels: { item: Item; model: Model }[] = [];
    const values: Item[] = [];

    for (const line of lines) {
      const t = line.text;
      if (line.y > height * 0.93) continue; // footer: edition, website, page number
      if (line.y < height * 0.09) {
        // running header: the chapter ("FLOOR LAMPS"), centred; spec labels continued at the top of a page are not
        const x0 = Math.min(...line.items.map((i) => i.x));
        const x1 = Math.max(...line.items.map((i) => i.x + i.w));
        const centred = Math.abs((x0 + x1) / 2 - width / 2) < width * 0.12 && x1 - x0 < width * 0.5;
        if (centred && isUpper(t) && !/\d/.test(t) && t.length < 40) {
          section = t;
          continue;
        }
        if (/^\d+$/.test(t)) continue;
      }
      const art = articleOf(line);
      if (art) {
        if (!family) continue;
        if (!model || mode === "specs") {
          model = { name: "", header: "", rows: [], complete: null, specs: [], page: p };
          family.models.push(model);
        }
        model.rows.push(art);
        mode = "rows";
        continue;
      }
      const total = TOTAL_RE.test(t) ? t.match(MONEY_RE) : null;
      if (total && model) {
        model.complete = parseMoney(total[1] ?? total[2]);
        continue;
      }
      const mm = t.match(MODEL_RE);
      if (mm && family && t.length < 60) {
        if (family.page === p && family.until === undefined) family.until = line.y;
        model = { name: mm[1].trim(), header: "", rows: [], complete: null, specs: [], page: p };
        family.models.push(model);
        mode = "model";
        continue;
      }
      if (line.size >= body * 1.5 && t.length <= 60 && /^[A-Za-zÀ-ÿ]/.test(t) && !MONEY_RE.test(t) && !/\d\s*(cm|mm)\b/i.test(t)) {
        family = { name: t, designer: "", intro: [], section, page: p, y: line.y, models: [], images: [] };
        families.push(family);
        titlePages.set(p, [...(titlePages.get(p) ?? []), family]);
        model = null;
        mode = "intro";
        continue;
      }
      if (!family) continue;
      if (mode === "intro") {
        if (!family.designer && DESIGNER_RE.test(t)) family.designer = titleCase(t.replace(/,\s*(19|20)\d{2}$/, ""));
        else if (!isUpper(t)) family.intro.push(t);
        continue;
      }
      if (mode === "model" && model && !model.header && isUpper(t) && !model.rows.length) {
        model.header = t;
        continue;
      }
      if (!model) continue;
      mode = "specs";
      for (const it of line.items) {
        if (isUpper(it.text) && it.text.length >= 4 && !/\d/.test(it.text) && it.text.length < 45) labels.push({ item: it, model });
        else values.push(it);
      }
    }
    for (const [k, { item, model: owner }] of labels.entries()) {
      const below = labels.filter((o, j) => j !== k && Math.abs(o.item.x - item.x) < 8 && o.item.y > item.y + 1).map((o) => o.item.y);
      const limit = Math.min(item.y + 48, ...below);
      const v = values
        .filter((i) => Math.abs(i.x - item.x) < 8 && i.y > item.y + 1 && i.y < limit - 1)
        .sort((a, b) => a.y - b.y || a.x - b.x)
        .map((i) => i.text);
      // a value line can carry more words to the right ("63 x 189 x 63cm | 24.8” …   ø 63cm | 24.8”")
      const first = values.find((i) => Math.abs(i.x - item.x) < 8 && i.y > item.y + 1 && i.y < limit - 1);
      const rest = first ? values.filter((i) => i !== first && Math.abs(i.y - first.y) < 2 && i.x > first.x && i.x - (first.x + first.w) < 40 && !labels.some((l) => Math.abs(l.item.x - i.x) < 8)) : [];
      const value = [...v, ...rest.map((i) => i.text)].join(" ").replace(/\s+/g, " ").trim();
      if (value && !owner.specs.some(([l]) => l === item.text)) owner.specs.push([item.text, value]);
    }
  }

  // the family photo: the first photos on the page of its title, below the title
  if (withImages) {
    for (const [p, fams] of titlePages) {
      for (const [k, f] of fams.entries()) {
        const next = fams[k + 1]?.y;
        f.images = await familyPhotos(pdf, p, { y: f.y, until: Math.min(f.until ?? Infinity, next ?? Infinity) }).catch(() => []);
      }
    }
  }

  const rows: BlockRow[] = [];
  for (const f of families) {
    const type = singular(f.section);
    const familyWords = new Set(f.name.toLowerCase().split(/\s+/));
    const intro = f.intro.join(" ").replace(/\s+/g, " ").replace(/(\w)- (\w)/g, "$1$2").trim();
    for (const m of f.models) {
      if (!m.rows.length) continue;
      const spec = (re: RegExp) => m.specs.find(([l]) => re.test(l))?.[1] ?? "";
      const materials = spec(/material/i);
      const dimensions = spec(/dimension|size/i);
      const lightSource = [spec(/^(lamp ?holder|light ?sources?|bulb|socket)\b(?! included)/i), spec(/max power|wattage/i)].filter(Boolean).join(", ");
      const specText = m.specs.map(([l, v]) => `${sentence(l)}: ${v}`).join("\n");
      // the option words: model name and heading without the family name ("LARGE" + "WHITE")
      const opts = [m.name, m.header]
        .flatMap((s) => s.toLowerCase().split(/\s+/))
        .filter((w, i, all) => w && !familyWords.has(w) && all.indexOf(w) === i);
      const base = (r: { name: string }, variant: string, extra: string) => ({
        family: f.name,
        type,
        designer: f.designer,
        materials,
        lightSource,
        weight: spec(/weight/i),
        dimensions,
        images: f.images,
        page: m.page,
        finish: variant,
        variant,
        spec: [intro, extra, specText].filter(Boolean).join("\n\n"),
        desc: [variant, r.name].filter(Boolean).join(" / "),
      });
      if (m.rows.length > 1 && m.complete) {
        const variant = opts.join(" / ");
        const parts = m.rows.map((r) => `${r.name} (${r.code}) € ${r.price.toFixed(2)}`).join("\n");
        rows.push({ ...base({ name: "" }, variant, `Set:\n${parts}`), sku: m.rows.map((r) => r.code).join("+"), price: m.complete });
      } else if (m.rows.length === 1) {
        rows.push({ ...base(m.rows[0], opts.join(" / "), ""), sku: m.rows[0].code, price: m.rows[0].price });
      } else {
        // several complete articles under one model (colours / finishes)
        for (const r of m.rows) {
          const own = r.name
            .toLowerCase()
            .split(/[\s,]+/)
            .filter((w) => w && !familyWords.has(w) && !opts.includes(w));
          rows.push({ ...base(r, [...opts, ...own].join(" / "), ""), sku: r.code, price: r.price });
        }
      }
    }
  }
  const seen = new Set<string>();
  return {
    rows: rows.filter((r) => (seen.has(r.sku) ? false : (seen.add(r.sku), true))),
    pages: pdf.numPages,
    families: families.filter((f) => f.models.some((m) => m.rows.length)).length,
    text: textParts.join("\n"),
  };
}

/** A price at the end of a line, with or without the currency: "920.00", "1,030.00", "1.030,00 €", "€ 1.954". */
// thousands separated by "." "," or a non-breaking space only: an ordinary space would glue the code's last digits to the price
const TAIL_PRICE_RE = /(?:(?:€|EUR)\s*)?(\d{1,3}(?:[.,  ]\d{3})*[.,]\d{2}|\d+[.,]\d{2}|(?<=(?:€|EUR)\s*)\d{1,3}(?:[.  ]\d{3})*)\s*(?:€|EUR)?$/i;
const COLUMN_HEAD_RE = /\b(product number|article (?:no|number)|item no|retail price|price list|excl\.? (?:of )?vat|incl\.? (?:of )?vat|kaina)\b/i;

/**
 * Reads a *table* price list: groups of rows "finish / variant · code · price" under one or two
 * header lines (family, then the type), e.g.
 *
 *   Alouette
 *   Ceiling light / 1 Bird ‘T’
 *   Black (white reflector)        004OL-C01-ME01      920.00
 *   White (white reflector)        004OL-C01-ME02      920.00
 *
 * The header is the block of lines printed right above the first row of a group.
 */
export async function extractTablePriceList(data: ArrayBuffer, opts: { withImages?: boolean } = {}): Promise<{ rows: BlockRow[]; pages: number; families: number; text: string; exclVat: boolean }> {
  const withImages = opts.withImages ?? true;
  const pdf = await getDocumentProxy(new Uint8Array(data.slice(0)));
  const rows: BlockRow[] = [];
  const textParts: string[] = [];
  const families = new Set<string>();
  let exclVat = false;
  let found = 0;

  for (let p = 1; p <= pdf.numPages; p++) {
    if (p > 20 && found === 0) break;
    const page = await pdf.getPage(p);
    const height = page.view[3] - page.view[1];
    const content = await page.getTextContent();
    type Raw = { str: string; transform: number[]; width: number };
    const items: Item[] = [];
    for (const it of content.items as Raw[]) {
      if (typeof it.str !== "string" || !it.str.trim()) continue;
      if (Math.abs(it.transform[1]) > Math.abs(it.transform[0])) continue;
      items.push({ x: it.transform[4], y: height - it.transform[5], w: it.width || 0, size: Math.round(Math.hypot(it.transform[0], it.transform[1]) * 2) / 2, text: unspace(it.str.trim()) });
    }
    const lines = toLines(items).filter((l) => l.y < height * 0.95);
    if (p <= 3) textParts.push(lines.map((l) => l.text).join(" "));
    if (lines.some((l) => /excl\.?\s*(of\s*)?vat|be pvm|ohne mwst|iva esclusa/i.test(l.text))) exclVat = true;

    type Row = { y: number; name: string; code: string; price: number };
    const parsed: (Row | null)[] = lines.map((line) => {
      const m = line.text.match(TAIL_PRICE_RE);
      if (!m) return null;
      const before = line.text.slice(0, m.index).trim().split(" ");
      const ci = before.findLastIndex((w) => CODE_RE.test(w.replace(/[*,;]+$/, "")));
      if (ci < 0) return null;
      const price = parseMoney(m[1]);
      if (!Number.isFinite(price) || price <= 0) return null;
      return { y: line.y, name: before.slice(0, ci).join(" ").trim(), code: before[ci].replace(/[*,;]+$/, ""), price };
    });
    const rowYs = parsed.filter((r): r is Row => Boolean(r)).map((r) => r.y);
    const gaps = rowYs.slice(1).map((y, i) => y - rowYs[i]).filter((g) => g > 0).sort((a, b) => a - b);
    const step = gaps[Math.floor(gaps.length / 2)] ?? 14;

    type Group = { header: string[]; top: number; bottom: number; rows: Row[] };
    const groups: Group[] = [];
    let current: Group | null = null;
    for (const [i, line] of lines.entries()) {
      const r = parsed[i];
      if (!r) continue;
      const prev = i > 0 ? parsed[i - 1] : null;
      if (!current || !prev) {
        // the header: the lines right above, each within ~2 row steps of the next
        const header: string[] = [];
        let y = line.y;
        for (let k = i - 1; k >= 0 && header.length < 4; k--) {
          const l = lines[k];
          if (parsed[k] || y - l.y > step * 2.2) break;
          y = l.y;
          if (COLUMN_HEAD_RE.test(l.text) || /^[€$£]/.test(l.text)) break;
          header.unshift(l.text);
        }
        current = { header, top: y, bottom: line.y, rows: [] };
        groups.push(current);
      }
      current.rows.push(r);
      current.bottom = line.y;
      found++;
    }

    for (const g of groups) {
      // no header on this page: the rows continue the last group of the previous page
      const last = rows[rows.length - 1];
      const family = g.header[0] ?? last?.family ?? "";
      const typeLine = g.header.length ? g.header.slice(1).join(" / ") : last?.type ?? "";
      const segs = typeLine.split(/\s+\/\s+/).map((s) => s.trim()).filter(Boolean);
      const extra = segs.filter((s) => !/lamp|light|chandelier|sconce|pendant|chair|table|sofa|stool|bench|mirror|rug|vase|bed|cabinet|shelf/i.test(s));
      let images: string[] = [];
      if (withImages && g.header.length) {
        const photos = await photosOnPage(pdf, p, { within: { top: g.top - 40, bottom: g.bottom + 20 } }).catch(() => []);
        images = photos.slice(0, 2).map((ph) => ph.src);
      } else if (!g.header.length && last) images = last.images;
      if (family) families.add(family);
      for (const r of g.rows) {
        const variant = [...extra, r.name].filter(Boolean).join(" / ");
        rows.push({ sku: r.code, family, type: typeLine, desc: [typeLine, r.name].filter(Boolean).join(" / "), price: r.price, page: p, variant, finish: r.name, designer: "", materials: "", lightSource: "", weight: "", dimensions: "", images, spec: "" });
      }
    }
  }
  const seen = new Set<string>();
  return { rows: rows.filter((r) => (seen.has(r.sku) ? false : (seen.add(r.sku), true))), pages: pdf.numPages, families: families.size, text: textParts.join("\n"), exclVat };
}
