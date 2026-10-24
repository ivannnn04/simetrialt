import type { ImageCandidate } from "@/lib/ai";

/**
 * Web image search for product photos. One of three providers, picked by the configured key:
 *
 * - SERPER_API_KEY            Serper.dev: Google Images results for the whole web (recommended).
 * - BRAVE_SEARCH_API_KEY      Brave Search image API, whole web.
 * - GOOGLE_CSE_KEY + GOOGLE_CSE_CX
 *                             Google Programmable Search; new engines can only search the sites
 *                             listed in them (Google retired "search the entire web" in 2026), so
 *                             list the supplier websites there.
 */
export function imageSearchProvider(): "serper" | "brave" | "google" | null {
  if (process.env.SERPER_API_KEY) return "serper";
  if (process.env.BRAVE_SEARCH_API_KEY) return "brave";
  if (process.env.GOOGLE_CSE_KEY && process.env.GOOGLE_CSE_CX) return "google";
  return null;
}
export const imageSearchEnabled = () => imageSearchProvider() !== null;

export async function searchImages(query: string, count = 10): Promise<ImageCandidate[]> {
  switch (imageSearchProvider()) {
    case "serper":
      return serper(query, count);
    case "brave":
      return brave(query, count);
    case "google":
      return google(query, count);
    default:
      throw new Error("Nuotraukų paieška neįjungta: nustatykite SERPER_API_KEY (arba BRAVE_SEARCH_API_KEY / GOOGLE_CSE_KEY + GOOGLE_CSE_CX).");
  }
}

const host = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

async function readError(res: Response, label: string): Promise<never> {
  const body = await res.text().catch(() => "");
  let reason = body.slice(0, 160);
  try {
    const j = JSON.parse(body) as { error?: { message?: string } | string; message?: string };
    reason = (typeof j.error === "string" ? j.error : j.error?.message) ?? j.message ?? reason;
  } catch {
    /* not JSON */
  }
  throw new Error(`${label} paieška nepavyko (${res.status}): ${reason}`);
}

type SerperImage = { imageUrl: string; thumbnailUrl?: string; title?: string; source?: string; link?: string; imageWidth?: number; imageHeight?: number };

async function serper(query: string, count: number): Promise<ImageCandidate[]> {
  const res = await fetch("https://google.serper.dev/images", {
    method: "POST",
    headers: { "X-API-KEY": process.env.SERPER_API_KEY!, "content-type": "application/json" },
    body: JSON.stringify({ q: query, num: Math.min(20, count) }),
    cache: "no-store",
  });
  if (!res.ok) await readError(res, "Serper");
  const json = (await res.json()) as { images?: SerperImage[] };
  return (json.images ?? [])
    .filter((it) => /^https?:\/\//.test(it.imageUrl) && (it.imageWidth ?? 1000) >= 300)
    .slice(0, count)
    .map((it) => ({ src: it.imageUrl, thumb: it.thumbnailUrl ?? it.imageUrl, source: it.source || host(it.link ?? it.imageUrl), title: it.title ?? "" }));
}

type BraveImage = { url?: string; title?: string; source?: string; thumbnail?: { src?: string }; properties?: { url?: string; width?: number; height?: number } };

async function brave(query: string, count: number): Promise<ImageCandidate[]> {
  const url = new URL("https://api.search.brave.com/res/v1/images/search");
  url.searchParams.set("q", query);
  url.searchParams.set("count", String(Math.min(20, count)));
  url.searchParams.set("safesearch", "strict");
  const res = await fetch(url, { headers: { Accept: "application/json", "X-Subscription-Token": process.env.BRAVE_SEARCH_API_KEY! }, cache: "no-store" });
  if (!res.ok) await readError(res, "Brave");
  const json = (await res.json()) as { results?: BraveImage[] };
  return (json.results ?? [])
    .map((it) => ({ src: it.properties?.url ?? "", thumb: it.thumbnail?.src ?? it.properties?.url ?? "", source: it.source || host(it.url ?? ""), title: it.title ?? "", width: it.properties?.width ?? 1000 }))
    .filter((it) => /^https?:\/\//.test(it.src) && it.width >= 300)
    .slice(0, count)
    .map(({ src, thumb, source, title }) => ({ src, thumb, source, title }));
}

type CseItem = { link: string; title?: string; displayLink?: string; image?: { thumbnailLink?: string; width?: number; height?: number } };

async function google(query: string, count: number): Promise<ImageCandidate[]> {
  const url = new URL("https://www.googleapis.com/customsearch/v1");
  url.searchParams.set("key", process.env.GOOGLE_CSE_KEY!);
  url.searchParams.set("cx", process.env.GOOGLE_CSE_CX!);
  url.searchParams.set("searchType", "image");
  url.searchParams.set("imgType", "photo");
  url.searchParams.set("num", String(Math.min(10, count)));
  url.searchParams.set("safe", "active");
  url.searchParams.set("q", query);
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) await readError(res, "Google");
  const json = (await res.json()) as { items?: CseItem[] };
  return (json.items ?? [])
    .filter((it) => /^https?:\/\//.test(it.link) && (it.image?.width ?? 0) >= 300)
    .map((it) => ({ src: it.link, thumb: it.image?.thumbnailLink ?? it.link, source: it.displayLink ?? host(it.link), title: it.title ?? "" }));
}
