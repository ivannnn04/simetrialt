import sharp from "sharp";
import { getDocumentProxy, getResolvedPDFJS, renderPageAsImage } from "unpdf";

type PdfDoc = Awaited<ReturnType<typeof getDocumentProxy>>;
export type PagePhoto = { x: number; y: number; w: number; h: number; src: string };

/** Where each picture is painted on the page (points, from the top-left corner). */
async function imageBoxes(pdf: PdfDoc, p: number): Promise<{ boxes: Omit<PagePhoto, "src">[]; width: number; height: number }> {
  const page = await pdf.getPage(p);
  const width = page.view[2] - page.view[0];
  const height = page.view[3] - page.view[1];
  const OPS = (await getResolvedPDFJS()).OPS;
  const ops = await page.getOperatorList();
  const boxes: Omit<PagePhoto, "src">[] = [];
  let ctm = [1, 0, 0, 1, 0, 0];
  const stack: number[][] = [];
  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i];
    const args = ops.argsArray[i] as number[];
    if (fn === OPS.save) stack.push(ctm);
    else if (fn === OPS.restore) ctm = stack.pop() ?? ctm;
    else if (fn === OPS.transform) ctm = mul(ctm, args);
    else if (fn === OPS.paintImageXObject || fn === OPS.paintInlineImageXObject || fn === OPS.paintImageXObjectRepeat) {
      // the unit square through the current matrix
      const xs = [ctm[4], ctm[0] + ctm[4], ctm[2] + ctm[4], ctm[0] + ctm[2] + ctm[4]];
      const ys = [ctm[5], ctm[1] + ctm[5], ctm[3] + ctm[5], ctm[1] + ctm[3] + ctm[5]];
      const x0 = Math.max(0, Math.min(...xs));
      const x1 = Math.min(width, Math.max(...xs));
      const top = Math.max(0, height - Math.max(...ys));
      const bottom = Math.min(height, height - Math.min(...ys));
      boxes.push({ x: x0, y: top, w: x1 - x0, h: bottom - top });
    }
  }
  return { boxes, width, height };
}

/**
 * The pictures printed on one PDF page, cut out of a rendering of the page, so they look exactly as
 * printed (masks, clipping and colour profiles applied). Sorted top to bottom. Icons, full-page
 * backgrounds and empty (single-colour) areas are skipped.
 */
export async function photosOnPage(pdf: PdfDoc, p: number, opts: { minSize?: number; maxSize?: number; within?: { top: number; bottom: number } } = {}): Promise<PagePhoto[]> {
  const minSize = opts.minSize ?? 40;
  const maxSize = opts.maxSize ?? 1200;
  const { boxes, width, height } = await imageBoxes(pdf, p);
  const wanted = boxes.filter(
    (b) =>
      b.w >= minSize &&
      b.h >= minSize &&
      b.w * b.h < width * height * 0.8 &&
      (!opts.within || (b.y + b.h / 2 >= opts.within.top && b.y + b.h / 2 <= opts.within.bottom))
  );
  if (!wanted.length) return [];
  const scale = 3;
  const png = Buffer.from(await renderPageAsImage(pdf, p, { scale, canvasImport: () => import("@napi-rs/canvas") }));
  const meta = await sharp(png).metadata();
  const out: PagePhoto[] = [];
  for (const b of wanted.sort((a, c) => a.y - c.y || a.x - c.x)) {
    const left = Math.max(0, Math.floor(b.x * scale));
    const top = Math.max(0, Math.floor(b.y * scale));
    const w = Math.min((meta.width ?? 0) - left, Math.ceil(b.w * scale));
    const h = Math.min((meta.height ?? 0) - top, Math.ceil(b.h * scale));
    if (w < 10 || h < 10) continue;
    try {
      const crop = sharp(png).extract({ left, top, width: w, height: h }).flatten({ background: "#ffffff" });
      const stats = await crop.clone().stats();
      if (stats.channels.every((c) => c.stdev < 4)) continue; // a plain background box
      const buf = await crop.resize({ width: maxSize, height: maxSize, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 86 }).toBuffer();
      out.push({ ...b, src: `data:image/jpeg;base64,${buf.toString("base64")}` });
    } catch {
      // skip a box that cannot be cut out
    }
  }
  return out;
}

/**
 * The photo of a product family: the pictures right below its title (the title's y on the page, or
 * found by its text), above the first model / price table. Drawings further down are left out.
 */
export async function familyPhotos(pdf: PdfDoc, p: number, title: { y?: number; name?: string; until?: number }): Promise<string[]> {
  let y = title.y;
  if (y === undefined && title.name) {
    const page = await pdf.getPage(p);
    const height = page.view[3] - page.view[1];
    const content = await page.getTextContent();
    const want = title.name.trim().toLowerCase();
    const hits = (content.items as { str: string; transform: number[] }[])
      .filter((i) => typeof i.str === "string" && i.str.trim().toLowerCase() === want)
      .sort((a, b) => Math.hypot(b.transform[0], b.transform[1]) - Math.hypot(a.transform[0], a.transform[1]));
    if (hits[0]) y = height - hits[0].transform[5];
  }
  const photos =
    y !== undefined
      ? await photosOnPage(pdf, p, { within: { top: y - 10, bottom: Math.min(title.until ?? Infinity, y + 260) } })
      : (await photosOnPage(pdf, p)).slice(0, 1);
  return photos.slice(0, 3).map((ph) => ph.src);
}

function mul(m: number[], t: number[]): number[] {
  return [t[0] * m[0] + t[1] * m[2], t[0] * m[1] + t[1] * m[3], t[2] * m[0] + t[3] * m[2], t[2] * m[1] + t[3] * m[3], t[4] * m[0] + t[5] * m[2] + m[4], t[4] * m[1] + t[5] * m[3] + m[5]];
}
