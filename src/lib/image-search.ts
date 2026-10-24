import type { ImageCandidate } from "@/lib/ai";

/**
 * Web image search for product photos. Uses Google Programmable Search (Custom Search JSON API)
 * with image search enabled. Needs GOOGLE_CSE_KEY and GOOGLE_CSE_CX; the engine should be set to
 * "search the entire web" with image search on.
 */
export const imageSearchEnabled = () => Boolean(process.env.GOOGLE_CSE_KEY && process.env.GOOGLE_CSE_CX);

type CseItem = { link: string; title?: string; displayLink?: string; image?: { thumbnailLink?: string; width?: number; height?: number } };

export async function searchImages(query: string, count = 10): Promise<ImageCandidate[]> {
  if (!imageSearchEnabled()) throw new Error("Nuotraukų paieška neįjungta: nustatykite GOOGLE_CSE_KEY ir GOOGLE_CSE_CX.");
  const url = new URL("https://www.googleapis.com/customsearch/v1");
  url.searchParams.set("key", process.env.GOOGLE_CSE_KEY!);
  url.searchParams.set("cx", process.env.GOOGLE_CSE_CX!);
  url.searchParams.set("searchType", "image");
  url.searchParams.set("imgType", "photo");
  url.searchParams.set("num", String(Math.min(10, count)));
  url.searchParams.set("safe", "active");
  url.searchParams.set("q", query);
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    let reason = body.slice(0, 160);
    try {
      reason = (JSON.parse(body) as { error?: { message?: string } }).error?.message ?? reason;
    } catch {
      /* not JSON */
    }
    throw new Error(`Google paieška nepavyko (${res.status}): ${reason}`);
  }
  const json = (await res.json()) as { items?: CseItem[] };
  return (json.items ?? [])
    .filter((it) => /^https?:\/\//.test(it.link) && (it.image?.width ?? 0) >= 300)
    .map((it) => ({ src: it.link, thumb: it.image?.thumbnailLink ?? it.link, source: it.displayLink ?? new URL(it.link).hostname, title: it.title ?? "" }));
}
