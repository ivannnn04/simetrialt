"use server";

import { revalidatePath } from "next/cache";
import sharp from "sharp";
import { requireEditor } from "@/lib/auth";
import { saveImage } from "@/lib/uploads";
import { ALL_SLOTS, SITE_IMAGES_KEY, getSiteImages } from "@/lib/site-images";
import { clearContentCache, writeSetting } from "@/lib/site-content";

export type SlotResult = { ok?: string; error?: string };

/** Full-resolution source → JPEG, at most 2880 px on the long side (2× the 1440 px design), very high quality. */
async function toJpeg(buf: Buffer, name: string): Promise<File> {
  const out = await sharp(buf).rotate().resize({ width: 2880, height: 2880, fit: "inside", withoutEnlargement: true }).flatten({ background: "#ffffff" }).jpeg({ quality: 86, mozjpeg: true }).toBuffer();
  return new File([new Uint8Array(out)], name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
}

/** Sets one slot from an uploaded file or from an image address (fetched and stored by the website). */
export async function saveSiteImage(slot: string, _prev: SlotResult | undefined, formData: FormData): Promise<SlotResult> {
  await requireEditor();
  if (!ALL_SLOTS.includes(slot)) return { error: "Nežinoma vieta" };
  try {
    const file = formData.get("file");
    const url = String(formData.get("url") ?? "").trim();
    let buf: Buffer;
    if (file instanceof File && file.size > 0) buf = Buffer.from(await file.arrayBuffer());
    else if (/^https?:\/\//.test(url)) {
      const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
      if (!res.ok) return { error: `Nepavyko atsisiųsti (HTTP ${res.status})` };
      buf = Buffer.from(await res.arrayBuffer());
    } else return { error: "Pasirinkite failą arba įveskite nuorodą" };
    const stored = await saveImage(await toJpeg(buf, slot.replace(/\//g, "-")));
    const map = { ...(await getSiteImages()), [slot]: stored };
    await writeSetting(SITE_IMAGES_KEY, map);
    clearContentCache();
    revalidatePath("/", "layout");
    revalidatePath("/admin/site-images");
    return { ok: "Išsaugota" };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Klaida" };
  }
}

export async function clearSiteImage(slot: string): Promise<void> {
  await requireEditor();
  const map = { ...(await getSiteImages()) };
  delete map[slot];
  await writeSetting(SITE_IMAGES_KEY, map);
  clearContentCache();
  revalidatePath("/", "layout");
  revalidatePath("/admin/site-images");
}
