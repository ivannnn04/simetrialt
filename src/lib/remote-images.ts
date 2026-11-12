import { createHash } from "crypto";
import sharp from "sharp";
import { db } from "@/lib/db";
import { saveImage } from "@/lib/uploads";

/** Stored copies of web photos, shared by every product that uses the same source (see the catalogue import). */
export const imageCacheKey = (src: string) => `imgcache:${createHash("sha1").update(src).digest("hex")}`;

/** Our own storage: Vercel Blob or the local uploads folder. Anything else is a photo on another website. */
export const isOwnImage = (url: string) => url.startsWith("/") || /\.blob\.vercel-storage\.com\//.test(url);

/**
 * Copies a web photo into our storage (max 1600 px JPEG) once and returns the stored URL; later calls
 * with the same source return the same copy.
 */
export async function storeRemoteImage(src: string): Promise<string> {
  const key = imageCacheKey(src);
  const hit = await db.setting.findUnique({ where: { key } });
  if (hit) return hit.value;
  const res = await fetch(src, { redirect: "follow", headers: { "user-agent": "Mozilla/5.0 (compatible; SimetriaImport/1.0)" } });
  if (!res.ok) throw new Error(`nuotraukos atsisiųsti nepavyko (${res.status})`);
  const buf = await sharp(Buffer.from(await res.arrayBuffer()))
    .rotate()
    .flatten({ background: "#ffffff" })
    .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85, mozjpeg: true })
    .toBuffer();
  const url = await saveImage(new File([new Uint8Array(buf)], "photo.jpg", { type: "image/jpeg" }));
  await db.setting.upsert({ where: { key }, create: { key, value: url }, update: { value: url } });
  return url;
}
