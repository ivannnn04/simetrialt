export const LOCALES = ["en", "lt"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

/** Request header the proxy sets so server components know the active locale. */
export const LOCALE_HEADER = "x-locale";
/** Request header carrying the public pathname (with the locale prefix) for hreflang links. */
export const PATHNAME_HEADER = "x-pathname";

export const LOCALE_LABELS: Record<Locale, string> = { en: "EN", lt: "LT" };

export function isLocale(value: string | null | undefined): value is Locale {
  return LOCALES.includes(value as Locale);
}

/** Locale encoded in a public pathname ("/lt/about" → "lt"), or the default locale. */
export function localeFromPathname(pathname: string): Locale {
  const seg = pathname.split("/")[1];
  return isLocale(seg) && seg !== DEFAULT_LOCALE ? seg : DEFAULT_LOCALE;
}

/** "/lt/about" → "/about"; "/about" stays. */
export function stripLocale(pathname: string): string {
  const seg = pathname.split("/")[1];
  if (isLocale(seg)) {
    const rest = pathname.slice(seg.length + 1);
    return rest === "" ? "/" : rest;
  }
  return pathname;
}

/** Prefixes an internal href with the locale segment (the default locale has none). */
export function localizeHref(locale: Locale, href: string): string {
  if (locale === DEFAULT_LOCALE) return href;
  if (!href.startsWith("/") || href.startsWith("//")) return href; // external, mailto:, tel:, #anchor, relative
  const seg = href.split(/[/?#]/)[1];
  if (isLocale(seg)) return href; // already localised
  return href === "/" ? `/${locale}` : `/${locale}${href}`;
}

/** The same page in another locale, keeping query string and hash. */
export function switchLocale(pathname: string, target: Locale, suffix = ""): string {
  return localizeHref(target, stripLocale(pathname)) + suffix;
}
