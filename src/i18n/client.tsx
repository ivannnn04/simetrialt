"use client";

import { createContext, useContext } from "react";
import { DEFAULT_LOCALE, localizeHref, type Locale } from "@/i18n/config";
import { getDictionary, type Dictionary } from "@/i18n/dictionaries";

const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);

export function LocaleProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useLocale(): Locale {
  return useContext(LocaleContext);
}

export function useT(): Dictionary {
  return getDictionary(useContext(LocaleContext));
}

/** Returns a function that prefixes internal hrefs for the active locale (for router.push etc.). */
export function useHref(): (href: string) => string {
  const locale = useContext(LocaleContext);
  return (href) => localizeHref(locale, href);
}
