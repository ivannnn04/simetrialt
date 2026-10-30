import sharp from "sharp";
import { extractImages, getDocumentProxy, getResolvedPDFJS } from "unpdf";

type PdfDoc = Awaited<ReturnType<typeof getDocumentProxy>>;

/**
 * The photos printed on one PDF page with their vertical position (from the top of the page),
 * as JPEG data URLs of at most `maxSize` px. Tiny images (icons, CE marks) are skipped.
 */
export async function photosOnPage(pdf: PdfDoc, p: number, opts: { minSize?: number; maxSize?: number } = {}): Promise<{ y: number; src: string }[]> {
  const minSize = opts.minSize ?? 100;
  const maxSize = opts.maxSize ?? 560;
  const page = await pdf.getPage(p);
  const pageHeight = page.view[3] - page.view[1];
  const OPS = (await getResolvedPDFJS()).OPS;
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
    else if (fn === OPS.paintImageXObject || fn === OPS.paintInlineImageXObject) positions.push(pageHeight - (ctm[1] * 0.5 + ctm[3] * 0.5 + ctm[5]));
  }
  let extracted: Awaited<ReturnType<typeof extractImages>> = [];
  try {
    extracted = await extractImages(pdf, p);
  } catch {
    return [];
  }
  const out: { y: number; src: string }[] = [];
  for (const [n, img] of extracted.entries()) {
    if (img.width < minSize || img.height < minSize) continue;
    try {
      const buf = await sharp(Buffer.from(img.data.buffer, img.data.byteOffset, img.data.byteLength), { raw: { width: img.width, height: img.height, channels: img.channels } })
        .flatten({ background: "#ffffff" })
        .resize({ width: maxSize, height: maxSize, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer();
      out.push({ y: positions[n] ?? 0, src: `data:image/jpeg;base64,${buf.toString("base64")}` });
    } catch {
      // unreadable image data: skip it
    }
  }
  return out.sort((a, b) => a.y - b.y);
}

function mul(m: number[], t: number[]): number[] {
  return [t[0] * m[0] + t[1] * m[2], t[0] * m[1] + t[1] * m[3], t[2] * m[0] + t[3] * m[2], t[2] * m[1] + t[3] * m[3], t[4] * m[0] + t[5] * m[2] + m[4], t[4] * m[1] + t[5] * m[3] + m[5]];
}
