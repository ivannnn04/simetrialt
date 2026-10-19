import { db, tryDb } from "@/lib/db";
import type { Locale } from "@/i18n/config";
import { PROJECTS, type Project } from "@/data/projects";
import { BRANDS, type Brand } from "@/data/brands";
import { PROJECT_SLIDES_IMAGE } from "@/data/project-slides";

/**
 * Editable site content. Everything the admin changes is stored as JSON in the `Setting`
 * table (no schema migration needed) and falls back to the values shipped in the code, so the
 * public site keeps working while no database is reachable.
 *
 *   content:<locale>  flat { "home.hero.text": "..." } overrides over the dictionary
 *   data:projects     Project[]
 *   data:brands       Brand[]
 *   data:slides       { image }  photo behind the projects slider (slide copy lives in content)
 *   site:contacts     SiteContacts
 */

export type ContentOverrides = Record<string, string | string[]>;

export type SiteContacts = {
  phone: string;
  phoneHref: string;
  email: string;
  address: string;
  mapUrl: string;
  instagram: string;
  facebook: string;
  linkedin: string;
  privacyUrl: string;
  cookieUrl: string;
};

export type SlidesData = { image: string };

export const DEFAULT_CONTACTS: SiteContacts = {
  phone: "069 029 606",
  phoneHref: "tel:+37069029606",
  email: "info@simetria.lt",
  address: "Vilnius, Lithuania",
  mapUrl: "https://www.google.com/maps/search/?api=1&query=Simetria+Showroom+Vilnius+Lithuania",
  instagram: "#",
  facebook: "#",
  linkedin: "#",
  privacyUrl: "#",
  cookieUrl: "#",
};

export const KEYS = {
  content: (locale: Locale) => `content:${locale}`,
  projects: "data:projects",
  brands: "data:brands",
  slides: "data:slides",
  contacts: "site:contacts",
} as const;

const CACHE_MS = 30_000;
const cache = new Map<string, { at: number; value: unknown }>();

/** Reads one JSON setting with a short in-memory cache; `undefined` when unset or the DB is down. */
export async function readSetting<T>(key: string): Promise<T | undefined> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value as T | undefined;
  const row = await tryDb(`setting ${key}`, () => db.setting.findUnique({ where: { key } }));
  let value: T | undefined;
  if (row?.value) {
    try {
      value = JSON.parse(row.value) as T;
    } catch {
      value = undefined;
    }
  }
  cache.set(key, { at: Date.now(), value });
  return value;
}

/** Writes one JSON setting (admin only; throws when the DB is unavailable). */
export async function writeSetting(key: string, value: unknown): Promise<void> {
  const serialized = JSON.stringify(value);
  await db.setting.upsert({ where: { key }, update: { value: serialized }, create: { key, value: serialized } });
  cache.delete(key);
}

export async function deleteSetting(key: string): Promise<void> {
  await db.setting.deleteMany({ where: { key } });
  cache.delete(key);
}

export function clearContentCache() {
  cache.clear();
}

// ---------- readers used by the public site ----------

export async function getContentOverrides(locale: Locale): Promise<ContentOverrides> {
  return (await readSetting<ContentOverrides>(KEYS.content(locale))) ?? {};
}

export async function getProjects(): Promise<Project[]> {
  const stored = await readSetting<Project[]>(KEYS.projects);
  return stored && stored.length ? stored : PROJECTS;
}

export async function getProjectBySlug(slug: string): Promise<Project | undefined> {
  return (await getProjects()).find((p) => p.slug === slug);
}

export async function getBrands(): Promise<Brand[]> {
  const stored = await readSetting<Brand[]>(KEYS.brands);
  return stored && stored.length ? stored : BRANDS;
}

export async function getBrandBySlug(slug: string): Promise<Brand | undefined> {
  return (await getBrands()).find((b) => b.slug === slug);
}

export async function getSlides(): Promise<SlidesData> {
  const stored = await readSetting<SlidesData>(KEYS.slides);
  return stored?.image ? stored : { image: PROJECT_SLIDES_IMAGE };
}

export async function getContacts(): Promise<SiteContacts> {
  const stored = await readSetting<Partial<SiteContacts>>(KEYS.contacts);
  return { ...DEFAULT_CONTACTS, ...(stored ?? {}) };
}

/** Everything the client needs at render time (passed through the locale provider). */
export async function getSiteRuntime(locale: Locale) {
  const [overrides, contacts] = await Promise.all([getContentOverrides(locale), getContacts()]);
  return { overrides, contacts };
}
