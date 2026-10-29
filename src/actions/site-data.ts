"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireEditor } from "@/lib/auth";
import { slugify } from "@/lib/slug";
import { saveImage } from "@/lib/uploads";
import type { Project, ProjectType } from "@/data/projects";
import type { Brand } from "@/data/brands";
import {
  KEYS,
  getBrands,
  getContacts,
  getProjects,
  getSlides,
  writeSetting,
  clearContentCache,
  type SiteContacts,
} from "@/lib/site-content";

function revalidateSite() {
  revalidatePath("/", "layout");
  revalidatePath("/lt", "layout");
}

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
const lines = (fd: FormData, key: string) =>
  str(fd, key)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
const paragraphs = (fd: FormData, key: string) =>
  str(fd, key)
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean);
/** "Key: value" lines → [key, value][] */
const pairs = (fd: FormData, key: string): [string, string][] =>
  lines(fd, key).map((l) => {
    const i = l.indexOf(":");
    return i < 0 ? [l, ""] : [l.slice(0, i).trim(), l.slice(i + 1).trim()];
  });

/** Uploaded file wins over the typed URL; the previous value stays when neither is given. */
async function imageField(fd: FormData, key: string, previous: string): Promise<string> {
  const file = fd.get(`${key}File`);
  if (file instanceof File && file.size > 0) return saveImage(file);
  return str(fd, key) || previous;
}

// ---------- Projects ----------

const PROJECT_TYPES: ProjectType[] = ["private", "public", "other"];

export async function saveProject(originalSlug: string | null, formData: FormData) {
  await requireEditor();
  const projects = [...(await getProjects())];
  const existing = originalSlug ? projects.find((p) => p.slug === originalSlug) : undefined;
  const name = str(formData, "name");
  if (!name) throw new Error("Pavadinimas privalomas");
  const slug = slugify(str(formData, "slug") || name);
  if (projects.some((p) => p.slug === slug && p.slug !== originalSlug)) throw new Error("Toks adresas (slug) jau naudojamas");
  const typeRaw = str(formData, "type") as ProjectType;
  const type = PROJECT_TYPES.includes(typeRaw) ? typeRaw : "private";

  const project: Project = {
    slug,
    name,
    category: str(formData, "category"),
    type,
    kind: str(formData, "kind"),
    image: await imageField(formData, "image", existing?.image ?? `/images/projects/${slug}/cover.jpg`),
    aboutTitle: str(formData, "aboutTitle"),
    about: paragraphs(formData, "about"),
    sectionTitle: str(formData, "sectionTitle"),
    sectionText: str(formData, "sectionText"),
    lightTitle: str(formData, "lightTitle"),
    light: paragraphs(formData, "light"),
    specs: pairs(formData, "specs"),
    // own photos (one URL per line); the Lithuanian copy and source of imported projects are kept
    ...(formData.has("gallery") ? { gallery: lines(formData, "gallery") } : existing?.gallery ? { gallery: existing.gallery } : {}),
    ...(existing?.lt ? { lt: existing.lt } : {}),
    ...(existing?.source ? { source: existing.source } : {}),
  };

  const index = existing ? projects.indexOf(existing) : -1;
  if (index >= 0) projects[index] = project;
  else projects.push(project);
  await writeSetting(KEYS.projects, projects);
  clearContentCache();
  revalidateSite();
  redirect(`/admin/projects/${slug}?saved=1`);
}

export async function deleteProject(slug: string) {
  await requireEditor();
  const projects = (await getProjects()).filter((p) => p.slug !== slug);
  await writeSetting(KEYS.projects, projects);
  clearContentCache();
  revalidateSite();
  redirect("/admin/projects");
}

export async function moveProject(slug: string, direction: -1 | 1) {
  await requireEditor();
  const projects = [...(await getProjects())];
  const i = projects.findIndex((p) => p.slug === slug);
  const j = i + direction;
  if (i < 0 || j < 0 || j >= projects.length) return;
  [projects[i], projects[j]] = [projects[j], projects[i]];
  await writeSetting(KEYS.projects, projects);
  clearContentCache();
  revalidateSite();
  revalidatePath("/admin/projects");
}

// ---------- Brands ----------

const HEIGHTS = [458, 366, 275] as const;

export async function saveBrand(originalSlug: string | null, formData: FormData) {
  await requireEditor();
  const brands = [...(await getBrands())];
  const existing = originalSlug ? brands.find((b) => b.slug === originalSlug) : undefined;
  const name = str(formData, "name");
  if (!name) throw new Error("Pavadinimas privalomas");
  const slug = slugify(str(formData, "slug") || name);
  if (brands.some((b) => b.slug === slug && b.slug !== originalSlug)) throw new Error("Toks adresas (slug) jau naudojamas");

  // "Title | 458" per line; the height cycles through the Figma strip when omitted
  const collections: Brand["collections"] = lines(formData, "collections").map((l, i) => {
    const [title, h] = l.split("|").map((s) => s.trim());
    const height = (HEIGHTS as readonly number[]).includes(Number(h)) ? (Number(h) as 458 | 366 | 275) : ([458, 366, 275, 366] as const)[i % 4];
    return { title, height };
  });

  const markText = str(formData, "markText");
  const markClass = str(formData, "markClass");
  const brand: Brand = {
    slug,
    name,
    category: str(formData, "category"),
    country: str(formData, "country"),
    mark: markText || markClass ? { text: markText || undefined, className: markClass || undefined } : undefined,
    collections,
  };

  const index = existing ? brands.indexOf(existing) : -1;
  if (index >= 0) brands[index] = brand;
  else brands.push(brand);
  await writeSetting(KEYS.brands, brands);
  clearContentCache();
  revalidateSite();
  redirect(`/admin/brands/${slug}?saved=1`);
}

export async function deleteBrand(slug: string) {
  await requireEditor();
  await writeSetting(KEYS.brands, (await getBrands()).filter((b) => b.slug !== slug));
  clearContentCache();
  revalidateSite();
  redirect("/admin/brands");
}

export async function moveBrand(slug: string, direction: -1 | 1) {
  await requireEditor();
  const brands = [...(await getBrands())];
  const i = brands.findIndex((b) => b.slug === slug);
  const j = i + direction;
  if (i < 0 || j < 0 || j >= brands.length) return;
  [brands[i], brands[j]] = [brands[j], brands[i]];
  await writeSetting(KEYS.brands, brands);
  clearContentCache();
  revalidateSite();
  revalidatePath("/admin/brands");
}

// ---------- Site settings ----------

export async function saveSettings(formData: FormData) {
  await requireEditor();
  const current = await getContacts();
  const phone = str(formData, "phone") || current.phone;
  const contacts: SiteContacts = {
    phone,
    phoneHref: str(formData, "phoneHref") || `tel:${phone.replace(/[^+\d]/g, "")}`,
    email: str(formData, "email") || current.email,
    address: str(formData, "address") || current.address,
    mapUrl: str(formData, "mapUrl") || current.mapUrl,
    instagram: str(formData, "instagram"),
    facebook: str(formData, "facebook"),
    linkedin: str(formData, "linkedin"),
    privacyUrl: str(formData, "privacyUrl"),
    cookieUrl: str(formData, "cookieUrl"),
  };
  await writeSetting(KEYS.contacts, contacts);

  const slides = await getSlides();
  const image = await imageField(formData, "slidesImage", slides.image);
  await writeSetting(KEYS.slides, { image });

  clearContentCache();
  revalidateSite();
  redirect("/admin/settings?saved=1");
}
