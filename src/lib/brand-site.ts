/**
 * Product photos from the supplier's own website: the site map lists the product pages, each
 * product family in the price list is matched to the page whose address carries the family name,
 * and the photos are read from that page.
 */

const UA = "Mozilla/5.0 (compatible; SimetriaImport/1.0; +https://simetria.lt)";
const FETCH_TIMEOUT_MS = 15000;
const MAX_SITEMAPS = 12;
const IMAGE_SKIP_RE = /logo|icon|favicon|sprite|placeholder|avatar|flag|badge|banner|hero|apertura|catalog|catalogue|booklet|pdf|video|cover|\.svg|\.gif|pixel|spacer|loading|blank|thumb_|-\d{1,2}x\d{1,2}\.|2000x1125|1920x\d+/i;
const IMAGE_EXT_RE = /\.(jpe?g|png|webp)(\?|$)/i;

async function get(url: string): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers: { "user-agent": UA, accept: "text/html,application/xml,text/xml,*/*" }, redirect: "follow", signal: ctrl.signal });
    if (!res.ok) throw new Error(`${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

const locs = (xml: string) => [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => decodeEntities(m[1]));
const decodeEntities = (s: string) => s.replace(/&amp;/g, "&").replace(/&#0?39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">");

/** All page URLs listed in the site's sitemaps (product sitemaps first), same host only. */
export async function siteUrls(website: string): Promise<string[]> {
  const base = new URL(website);
  const origin = base.origin;
  const candidates = [`${origin}/sitemap.xml`, `${origin}/sitemap_index.xml`, `${origin}/sitemap-products.xml`, `${origin}/product-sitemap.xml`, `${origin}/wp-sitemap.xml`];
  try {
    const robots = await get(`${origin}/robots.txt`);
    for (const m of robots.matchAll(/^sitemap:\s*(\S+)/gim)) candidates.unshift(m[1]);
  } catch {
    /* no robots.txt */
  }
  const urls = new Set<string>();
  const queue = [...new Set(candidates)];
  let fetched = 0;
  const seen = new Set<string>();
  while (queue.length && fetched < MAX_SITEMAPS) {
    const u = queue.shift()!;
    if (seen.has(u)) continue;
    seen.add(u);
    let xml: string;
    try {
      xml = await get(u);
    } catch {
      continue;
    }
    fetched++;
    if (/<sitemapindex/i.test(xml)) {
      // product sitemaps first, then the rest
      const subs = locs(xml);
      queue.unshift(...subs.filter((s) => /product|prod|catalog|shop|item/i.test(s)), ...subs.filter((s) => !/product|prod|catalog|shop|item/i.test(s) && !/post|blog|news|project|tag|category|author|page|install|press|event|job/i.test(s)));
    } else {
      for (const l of locs(xml)) {
        try {
          if (new URL(l).host === base.host) urls.add(l);
        } catch {
          /* ignore */
        }
      }
    }
    if (urls.size > 20000) break;
  }
  // prefer the language of the configured site address ("…/en/")
  const lang = base.pathname.match(/^\/([a-z]{2})(\/|$)/)?.[1];
  const list = [...urls];
  if (lang) {
    const inLang = list.filter((u) => new URL(u).pathname.startsWith(`/${lang}/`));
    if (inLang.length) return inLang;
  }
  // otherwise keep pages without a language prefix, falling back to everything
  const noLang = list.filter((u) => !/^\/[a-z]{2}\//.test(new URL(u).pathname));
  return noLang.length ? noLang : list;
}

const slugTokens = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);

const TYPE_CODES: [RegExp, string[]][] = [
  [/wall/i, ["w", "wall", "parete", "ap"]],
  [/table|desk/i, ["t", "table", "tavolo"]],
  [/floor|standing/i, ["f", "floor", "terra"]],
  [/ceiling/i, ["c", "cw", "ceiling", "soffitto"]],
  [/pendant|suspension|hanging/i, ["s", "pendant", "sospensione"]],
  [/chandelier/i, ["chandelier"]],
  [/recessed/i, ["r", "recessed"]],
  [/outdoor/i, ["outdoor"]],
];

/**
 * The product page for a family ("Lederam C180", "PostKrisi 50") and type ("wall lamp"): the URL whose
 * last path segment contains every word of the family name; ties go to the one that also names the type.
 */
export function matchProductPage(family: string, typeHint: string, urls: string[]): string | null {
  const fam = slugTokens(family.replace(/\bmod(?:el)?\.?\s+\S+/gi, " "));
  if (!fam.length) return null;
  const famJoined = fam.join("");
  const typeWords = TYPE_CODES.filter(([re]) => re.test(typeHint)).flatMap(([, w]) => w);
  const typeNumbers = slugTokens(typeHint).filter((t) => /^\d+$/.test(t));
  let best: { url: string; score: number } | null = null;
  for (const u of urls) {
    const seg = new URL(u).pathname.split("/").filter(Boolean).pop() ?? "";
    const toks = slugTokens(seg.replace(/-/g, " "));
    const joined = toks.join("");
    // every family word must appear, or the family spelled without spaces ("luce d'oro" → "lucedoro")
    const hit = fam.every((t) => toks.includes(t)) || (famJoined.length >= 5 && joined.includes(famJoined));
    if (!hit) continue;
    let score = fam.length * 10 - Math.max(0, toks.length - fam.length); // shorter slugs are closer matches
    if (typeWords.some((w) => toks.includes(w))) score += 5;
    if (typeNumbers.some((n) => toks.includes(n))) score += 6;
    if (!best || score > best.score) best = { url: u, score };
  }
  return best?.url ?? null;
}

/** Photo URLs printed on a product page, the social-sharing image first; logos and icons skipped. */
export async function pageImages(url: string, limit = 4): Promise<string[]> {
  const html = await get(url);
  const found: string[] = [];
  const add = (raw: string) => {
    let u = decodeEntities(raw.trim());
    if (!u || u.startsWith("data:")) return;
    try {
      u = new URL(u, url).toString();
    } catch {
      return;
    }
    if (!IMAGE_EXT_RE.test(u) || IMAGE_SKIP_RE.test(u)) return;
    if (!found.includes(u)) found.push(u);
  };
  for (const m of html.matchAll(/property=["']og:image(?::secure_url)?["'][^>]*content=["']([^"']+)["']/gi)) add(m[1]);
  for (const m of html.matchAll(/content=["']([^"']+)["'][^>]*property=["']og:image["']/gi)) add(m[1]);
  // images passed through a resizer: url=https%3A%2F%2F…
  for (const m of html.matchAll(/[?&]url=(https?%3A%2F%2F[^&"'\s]+)/gi)) add(decodeURIComponent(m[1]));
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = m[0];
    for (const attr of ["data-src", "data-lazy-src", "data-original", "src"]) {
      const v = tag.match(new RegExp(`${attr}=["']([^"']+)["']`, "i"))?.[1];
      if (v) add(v);
    }
    const srcset = tag.match(/(?:data-)?srcset=["']([^"']+)["']/i)?.[1];
    if (srcset) {
      // the largest candidate
      const parts = srcset.split(",").map((p) => p.trim().split(/\s+/)).filter((p) => p[0]);
      parts.sort((a, b) => Number.parseInt(b[1] ?? "0", 10) - Number.parseInt(a[1] ?? "0", 10));
      if (parts[0]) add(parts[0][0]);
    }
  }
  // the same photo in several sizes: keep the first (largest listed) per base name
  const byBase = new Map<string, string>();
  for (const u of found) {
    const base = u.replace(/-\d{2,4}x\d{2,4}(?=\.[a-z]+(\?|$))/i, "").replace(/\?.*$/, "");
    if (!byBase.has(base)) byBase.set(base, u);
  }
  return [...byBase.values()].slice(0, limit);
}

/** Runs the lookups a few at a time and tolerates failures. */
export async function mapConcurrent<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<(R | null)[]> {
  const out: (R | null)[] = new Array(items.length).fill(null);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      try {
        out[i] = await fn(items[i]);
      } catch {
        out[i] = null;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}
