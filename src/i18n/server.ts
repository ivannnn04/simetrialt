import { headers } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_HEADER, PATHNAME_HEADER, isLocale, type Locale } from "@/i18n/config";
import { getDictionary, type Dictionary } from "@/i18n/dictionaries";

/** Active locale for the current request (set by src/proxy.ts). */
export async function getLocale(): Promise<Locale> {
  const value = (await headers()).get(LOCALE_HEADER);
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/** Public pathname of the current request, including the locale prefix. */
export async function getPathname(): Promise<string> {
  return (await headers()).get(PATHNAME_HEADER) ?? "/";
}

export async function getT(): Promise<Dictionary> {
  return getDictionary(await getLocale());
}
