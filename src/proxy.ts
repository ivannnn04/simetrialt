import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_LOCALE, LOCALE_HEADER, PATHNAME_HEADER, isLocale } from "@/i18n/config";

/**
 * Locale routing: "/lt/..." is served by the same route files as "/...". The prefix is stripped
 * with a rewrite and the locale travels to the server components in a request header.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const seg = pathname.split("/")[1];
  const headers = new Headers(request.headers);
  headers.set(PATHNAME_HEADER, pathname);

  if (isLocale(seg)) {
    if (seg === DEFAULT_LOCALE) {
      // "/en/about" → "/about": the default locale has no prefix.
      const url = request.nextUrl.clone();
      url.pathname = pathname.slice(seg.length + 1) || "/";
      return NextResponse.redirect(url, 308);
    }
    headers.set(LOCALE_HEADER, seg);
    const url = request.nextUrl.clone();
    url.pathname = pathname.slice(seg.length + 1) || "/";
    url.search = search;
    return NextResponse.rewrite(url, { request: { headers } });
  }

  headers.set(LOCALE_HEADER, DEFAULT_LOCALE);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  // Everything except Next internals, static files and the admin/API areas.
  matcher: ["/((?!_next|api|admin|images|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)"],
};
