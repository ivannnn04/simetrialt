import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";

/**
 * Scoro CRM API v2 client. Every call is a JSON POST to
 * https://<subdomain>.scoro.com/api/v2/<module>/<action>/<id> carrying apiKey + company_account_id.
 * Calls are serialised and spaced so the smallest plan's limit (10 requests / 2 s) is never hit;
 * a 429 waits for the reset the headers announce and retries.
 */

export type ScoroConfig = {
  subdomain: string;
  apiKey: string;
  companyAccountId: string;
  /** Scoro language code for names and descriptions, e.g. "eng" or "lit" */
  lang: string;
  /** optional price list for product prices; default list when empty */
  priceListId: string;
  /** optional, only for public Marketplace integrations */
  appId: string;
  /** secret in the webhook URL; Scoro does not sign its webhooks */
  webhookSecret: string;
  /** contents of /scoro.txt, which Scoro reads to validate the webhook domain */
  domainToken: string;
  /** website products → Scoro products (create new, add link + photos to existing) */
  pushProducts: boolean;
  /** also overwrite name, description and price of products that already existed in Scoro */
  overwriteExisting: boolean;
  /** website inquiries → Scoro contact + quote */
  pushLeads: boolean;
  /** admin offers → Scoro quotes */
  pushQuotes: boolean;
  /** Scoro quotes → admin offers (webhook) */
  pullQuotes: boolean;
  /** fill the photo field of Scoro quote lines from the website when a quote is saved in Scoro (webhook) */
  enrichQuotes: boolean;
  /** Scoro prices → website prices (daily and on demand) */
  pullPrices: boolean;
  /** last successful price pull (ISO date) */
  lastPull: string;
};

const KEY = "scoro.config";

const DEFAULTS: ScoroConfig = {
  subdomain: "",
  apiKey: "",
  companyAccountId: "",
  lang: "eng",
  priceListId: "",
  appId: "",
  webhookSecret: "",
  domainToken: "",
  // everything starts switched off: nothing is sent to or taken from Scoro until enabled in the admin
  pushProducts: false,
  overwriteExisting: false,
  pushLeads: false,
  pushQuotes: false,
  pullQuotes: false,
  enrichQuotes: false,
  pullPrices: false,
  lastPull: "",
};

/** Settings saved in the admin; SCORO_* environment variables win when set. */
export async function scoroConfig(): Promise<ScoroConfig> {
  let saved: Partial<ScoroConfig> = {};
  try {
    const row = await db.setting.findUnique({ where: { key: KEY } });
    if (row) saved = JSON.parse(row.value) as Partial<ScoroConfig>;
  } catch {
    // no DB or bad JSON: defaults
  }
  const env = process.env;
  return {
    ...DEFAULTS,
    ...saved,
    subdomain: env.SCORO_SUBDOMAIN || saved.subdomain || "",
    apiKey: env.SCORO_API_KEY || saved.apiKey || "",
    companyAccountId: env.SCORO_COMPANY_ACCOUNT_ID || saved.companyAccountId || "",
  };
}

export async function saveScoroConfig(patch: Partial<ScoroConfig>): Promise<ScoroConfig> {
  const current = await scoroConfig();
  const next = { ...current, ...patch };
  if (!next.webhookSecret) next.webhookSecret = randomBytes(18).toString("base64url");
  const value = JSON.stringify(next);
  await db.setting.upsert({ where: { key: KEY }, update: { value }, create: { key: KEY, value } });
  return next;
}

export const isConfigured = (c: ScoroConfig) => Boolean(c.subdomain && c.apiKey && c.companyAccountId);

/** "simetria", "simetria.scoro.com" or a full URL all mean the same site. SCORO_BASE_URL is for tests. */
export function baseUrl(c: ScoroConfig): string {
  if (process.env.SCORO_BASE_URL) return process.env.SCORO_BASE_URL.replace(/\/+$/, "");
  const host = c.subdomain.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  return `https://${host.includes(".") ? host : `${host}.scoro.com`}/api/v2`;
}

export class ScoroError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
  }
}

let chain: Promise<unknown> = Promise.resolve();
let lastCall = 0;
const GAP_MS = 220;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Envelope<T> = { status?: string; statusCode?: number | string; messages?: { error?: string[] | Record<string, string> } | null; data?: T };

/**
 * One API call. `path` is "<module>/<action>[/<id>]"; `top` adds top-level fields such as filter, page,
 * per_page or detailed_response next to `request`.
 */
export async function scoroCall<T = unknown>(c: ScoroConfig, path: string, request: object = {}, top: object = {}): Promise<T> {
  if (!isConfigured(c)) throw new ScoroError("Scoro nesukonfigūruotas");
  const run = async (): Promise<T> => {
    for (let attempt = 0; ; attempt++) {
      const wait = lastCall + GAP_MS - Date.now();
      if (wait > 0) await sleep(wait);
      lastCall = Date.now();
      const res = await fetch(`${baseUrl(c)}/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(c.appId ? { "scoro-app-id": c.appId } : {}) },
        body: JSON.stringify({ apiKey: c.apiKey, company_account_id: c.companyAccountId, lang: c.lang || "eng", ...top, request }),
        signal: AbortSignal.timeout(30_000),
        cache: "no-store",
      });
      if (res.status === 429 && attempt < 4) {
        const reset = Number(res.headers.get("x-ratelimit-remaining")) === 0 ? Number(res.headers.get("x-ratelimit-reset")) : 2;
        await sleep(Math.min(60, Math.max(1, reset || 2)) * 1000);
        continue;
      }
      const text = await res.text();
      let body: Envelope<T>;
      try {
        body = JSON.parse(text) as Envelope<T>;
      } catch {
        throw new ScoroError(`Scoro ${path}: HTTP ${res.status} ${text.slice(0, 160)}`, res.status);
      }
      if (!res.ok || body.status !== "OK") {
        const m = body.messages?.error;
        const msg = Array.isArray(m) ? m.join("; ") : m ? Object.values(m).join("; ") : `HTTP ${res.status}`;
        throw new ScoroError(`Scoro ${path}: ${msg}`, res.status);
      }
      return body.data as T;
    }
  };
  const p = chain.then(run, run);
  chain = p.catch(() => undefined);
  return p;
}

export async function scoroLog(direction: "out" | "in", kind: string, ok: boolean, message: string) {
  try {
    await db.scoroLog.create({ data: { direction, kind, ok, message: message.slice(0, 1000) } });
  } catch {
    // logging must never break the sync
  }
}
