import type { Search } from "@/lib/catalogue";

/** Builds a pagination link that keeps the current filters / sort. */
export function pageHref(base: string, sp: Search, page: number) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (k === "page" || v === undefined) continue;
    (Array.isArray(v) ? v : [v]).forEach((x) => params.append(k, x));
  }
  if (page > 1) params.set("page", String(page));
  const q = params.toString();
  return q ? `${base}?${q}` : base;
}
