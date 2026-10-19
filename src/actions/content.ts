"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getPath } from "@/i18n/overrides";
import { KEYS, getContentOverrides, writeSetting, clearContentCache } from "@/lib/site-content";

function revalidateSite() {
  revalidatePath("/", "layout");
  revalidatePath("/lt", "layout");
}

const linesToArray = (raw: string) =>
  raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Saves one dictionary section for a locale. Every field arrives as `f:<path>` with its kind in
 * `k:<path>`; values equal to the shipped copy are dropped so only real edits are stored.
 */
export async function saveContentSection(locale: string, section: string, formData: FormData) {
  await requireUser();
  if (!isLocale(locale)) throw new Error("Unknown locale");
  const defaults = getDictionary(locale as Locale);
  const overrides = { ...(await getContentOverrides(locale as Locale)) };

  for (const [name, raw] of formData.entries()) {
    if (!name.startsWith("f:") || typeof raw !== "string") continue;
    const path = name.slice(2);
    if (path !== section && !path.startsWith(`${section}.`)) continue;
    const kind = String(formData.get(`k:${path}`) ?? "text");
    const value = kind === "lines" ? linesToArray(raw) : raw.replace(/\r\n/g, "\n");
    if (same(value, getPath(defaults, path))) delete overrides[path];
    else overrides[path] = value;
  }

  await writeSetting(KEYS.content(locale as Locale), overrides);
  clearContentCache();
  revalidateSite();
  redirect(`/admin/content/${section}?locale=${locale}&saved=1`);
}

/** Drops every stored edit of one section so the shipped copy shows again. */
export async function resetContentSection(locale: string, section: string) {
  await requireUser();
  if (!isLocale(locale)) throw new Error("Unknown locale");
  const overrides = { ...(await getContentOverrides(locale as Locale)) };
  for (const key of Object.keys(overrides)) {
    if (key === section || key.startsWith(`${section}.`)) delete overrides[key];
  }
  await writeSetting(KEYS.content(locale as Locale), overrides);
  clearContentCache();
  revalidateSite();
  redirect(`/admin/content/${section}?locale=${locale}&reset=1`);
}
