"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import sharp from "sharp";
import { requireEditor } from "@/lib/auth";
import { saveImage } from "@/lib/uploads";
import { PROJECTS, type Project } from "@/data/projects";
import { legacyToProject, parseLegacyProjects } from "@/lib/legacy-projects";
import { KEYS, clearContentCache, getProjects, readSetting, writeSetting } from "@/lib/site-content";

function revalidateSite() {
  revalidatePath("/", "layout");
  revalidatePath("/lt", "layout");
  revalidatePath("/admin/projects");
}

/**
 * Old simetria.lt projects (JSON from the export) → website projects. Existing projects with the same
 * address are kept unless "overwrite" is ticked; the eight sample projects are removed on request.
 */
export async function importLegacyProjects(formData: FormData): Promise<void> {
  await requireEditor();
  const json = String(formData.get("json") ?? "").trim();
  if (!json) redirect("/admin/projects?import=empty");
  let records;
  try {
    records = parseLegacyProjects(json);
  } catch {
    redirect("/admin/projects?import=bad");
  }
  const overwrite = formData.get("overwrite") === "on";
  const dropSamples = formData.get("dropSamples") === "on";
  const stored = (await readSetting<Project[]>(KEYS.projects)) ?? [];
  const sampleSlugs = new Set(PROJECTS.map((p) => p.slug));
  let projects = stored.length ? [...stored] : dropSamples ? [] : [...PROJECTS];
  if (dropSamples) projects = projects.filter((p) => !sampleSlugs.has(p.slug));
  let added = 0;
  let updated = 0;
  for (const r of records) {
    const p = legacyToProject(r);
    const i = projects.findIndex((x) => x.slug === p.slug);
    if (i < 0) {
      projects.push(p);
      added++;
    } else if (overwrite) {
      projects[i] = p;
      updated++;
    }
  }
  // newest first, like the old site
  if (!stored.length) projects.sort((a, b) => (b.specs.find(([k]) => k === "Year")?.[1] ?? "").localeCompare(a.specs.find(([k]) => k === "Year")?.[1] ?? ""));
  await writeSetting(KEYS.projects, projects);
  clearContentCache();
  revalidateSite();
  redirect(`/admin/projects?imported=${added}&updated=${updated}`);
}

const isStored = (url: string) => !/^https?:\/\//.test(url) || /\.blob\.vercel-storage\.com\//.test(url);

export type RehostResult = { moved: number; remaining: number; errors: string[]; error?: string };

/**
 * Copies project photos that still live on another site (the old simetria.lt) into the website's own
 * storage, keeping the original quality, and rewrites the project to the new addresses.
 * Works in rounds of ~40 s; the admin button repeats it until nothing is left.
 */
export async function rehostProjectPhotos(): Promise<RehostResult> {
  await requireEditor();
  const started = Date.now();
  const projects = [...(await getProjects())];
  const result: RehostResult = { moved: 0, remaining: 0, errors: [] };
  const done = new Map<string, string>();
  try {
    for (const p of projects) {
      const urls = [p.image, ...(p.gallery ?? [])].filter((u) => u && !isStored(u));
      for (const url of urls) {
        if (done.has(url)) continue;
        if (Date.now() - started > 40_000) break;
        try {
          const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          let buf = Buffer.from(await res.arrayBuffer());
          let type = (res.headers.get("content-type") ?? "").split(";")[0];
          if (!/^image\/(jpeg|png|webp|gif)$/.test(type)) type = /\.png$/i.test(url) ? "image/png" : "image/jpeg";
          // over the 8 MB upload limit: re-encode at full size, very high quality
          if (buf.length > 8 * 1024 * 1024) {
            buf = await sharp(buf).rotate().jpeg({ quality: 92, mozjpeg: true }).toBuffer();
            type = "image/jpeg";
          }
          const name = decodeURIComponent(url.split("/").pop() ?? "photo.jpg");
          done.set(url, await saveImage(new File([new Uint8Array(buf)], name, { type })));
          result.moved++;
        } catch (e) {
          result.errors.push(`${url.split("/").pop()}: ${e instanceof Error ? e.message : String(e)}`);
          done.set(url, url); // keep the old address, try again next time
        }
      }
      p.image = done.get(p.image) ?? p.image;
      if (p.gallery) p.gallery = p.gallery.map((u) => done.get(u) ?? u);
    }
  } catch (e) {
    result.error = e instanceof Error ? e.message : String(e);
  }
  await writeSetting(KEYS.projects, projects);
  clearContentCache();
  revalidateSite();
  result.remaining = projects.reduce((n, p) => n + new Set([p.image, ...(p.gallery ?? [])].filter((u) => u && !isStored(u))).size, 0);
  // stop the button's loop when only failing photos are left
  if (result.moved === 0 && result.errors.length) result.error = result.errors[0];
  return result;
}
