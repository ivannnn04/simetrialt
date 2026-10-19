"use client";

import { createContext, useContext, useMemo } from "react";
import { DEFAULT_LOCALE, localizeHref, type Locale } from "@/i18n/config";
import { getDictionary, type Dictionary } from "@/i18n/dictionaries";
import { applyOverrides, type Overrides } from "@/i18n/overrides";
import { DEFAULT_CONTACTS, type SiteContacts } from "@/lib/site-content";

type Runtime = { locale: Locale; overrides: Overrides; contacts: SiteContacts };

const RuntimeContext = createContext<Runtime>({ locale: DEFAULT_LOCALE, overrides: {}, contacts: DEFAULT_CONTACTS });

export function LocaleProvider({
  locale,
  overrides = {},
  contacts = DEFAULT_CONTACTS,
  children,
}: {
  locale: Locale;
  overrides?: Overrides;
  contacts?: SiteContacts;
  children: React.ReactNode;
}) {
  const value = useMemo(() => ({ locale, overrides, contacts }), [locale, overrides, contacts]);
  return <RuntimeContext.Provider value={value}>{children}</RuntimeContext.Provider>;
}

export function useLocale(): Locale {
  return useContext(RuntimeContext).locale;
}

export function useT(): Dictionary {
  const { locale, overrides } = useContext(RuntimeContext);
  return useMemo(() => applyOverrides(getDictionary(locale), overrides), [locale, overrides]);
}

/** Phone, e-mail, showroom and social links edited in the admin. */
export function useContacts(): SiteContacts {
  return useContext(RuntimeContext).contacts;
}

/** Returns a function that prefixes internal hrefs for the active locale (for router.push etc.). */
export function useHref(): (href: string) => string {
  const locale = useContext(RuntimeContext).locale;
  return (href) => localizeHref(locale, href);
}
