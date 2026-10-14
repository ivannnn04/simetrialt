import type { Metadata } from "next";
import "./globals.css";
import { LocaleProvider } from "@/i18n/client";
import { LOCALES, DEFAULT_LOCALE, stripLocale, localizeHref } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale, getPathname } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const path = stripLocale(await getPathname());
  return {
    title: t.meta.title,
    description: t.meta.description,
    alternates: {
      canonical: localizeHref(locale, path),
      languages: Object.fromEntries(LOCALES.map((l) => [l, localizeHref(l, path)])),
    },
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = (await getLocale()) ?? DEFAULT_LOCALE;
  return (
    <html lang={locale} className="h-full antialiased">
      <head>
        <link rel="preconnect" href="https://api.fontshare.com" />
        <link
          rel="stylesheet"
          href="https://api.fontshare.com/v2/css?f[]=switzer@400,500,600,700&display=swap"
        />
      </head>
      <body className="min-h-full flex flex-col">
        <LocaleProvider locale={locale}>{children}</LocaleProvider>
      </body>
    </html>
  );
}
