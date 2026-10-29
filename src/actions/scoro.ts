"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { isConfigured, saveScoroConfig, scoroCall, scoroConfig, scoroLog, type ScoroConfig } from "@/lib/scoro/client";
import { pullPrices, registerWebhooks, runSync, type SyncResult } from "@/lib/scoro/sync";

type Msg = { ok?: string; error?: string };
const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));

const SWITCHES = ["pushProducts", "overwriteExisting", "pushLeads", "pushQuotes", "pullQuotes", "enrichQuotes", "pullPrices"] as const;

export async function saveScoroSettings(_prev: Msg | undefined, formData: FormData): Promise<Msg> {
  await requireAdmin();
  const s = (k: string) => String(formData.get(k) ?? "").trim();
  const patch: Partial<ScoroConfig> = {
    subdomain: s("subdomain").replace(/^https?:\/\//, "").replace(/\.scoro\.com.*$/, "").replace(/\/.*$/, ""),
    companyAccountId: s("companyAccountId"),
    lang: s("lang") || "eng",
    priceListId: s("priceListId").replace(/\D/g, ""),
    domainToken: s("domainToken"),
  };
  // the key is never shown again; an empty field keeps the saved one
  if (s("apiKey")) patch.apiKey = s("apiKey");
  for (const k of SWITCHES) patch[k] = formData.get(k) === "on";
  await saveScoroConfig(patch);
  revalidatePath("/admin/scoro");
  return { ok: "Nustatymai išsaugoti." };
}

/** Read-only call: lists one product. */
export async function testScoro(): Promise<Msg> {
  await requireAdmin();
  const c = await scoroConfig();
  if (!isConfigured(c)) return { error: "Įveskite Scoro adresą, company_account_id ir API raktą." };
  try {
    const rows = await scoroCall<unknown[]>(c, "products/list", {}, { per_page: 1 });
    return { ok: `Ryšys veikia (${Array.isArray(rows) ? "produktai pasiekiami" : "atsakymas gautas"}).` };
  } catch (e) {
    return { error: errText(e) };
  }
}

/** One round of sending; the panel calls it again while something is still waiting. */
export async function syncScoroNow(): Promise<SyncResult & { error?: string }> {
  await requireAdmin();
  try {
    const r = await runSync(40_000);
    revalidatePath("/admin/scoro");
    return r;
  } catch (e) {
    return { tasks: 0, products: 0, checked: 0, created: 0, failed: 0, pendingProducts: 0, pendingTasks: 0, messages: [], error: errText(e) };
  }
}

export async function registerScoroWebhooks(): Promise<Msg> {
  await requireAdmin();
  const c = await scoroConfig();
  if (!isConfigured(c)) return { error: "Scoro nesukonfigūruotas." };
  try {
    const msg = await registerWebhooks(c);
    await scoroLog("out", "webhook", true, msg);
    return { ok: msg };
  } catch (e) {
    await scoroLog("out", "webhook", false, errText(e));
    return { error: errText(e) };
  }
}

export async function pullScoroPrices(): Promise<Msg> {
  await requireAdmin();
  const c = await scoroConfig();
  if (!isConfigured(c)) return { error: "Scoro nesukonfigūruotas." };
  try {
    const msg = await pullPrices(c, 50_000);
    await scoroLog("in", "prices", true, msg);
    revalidatePath("/admin/scoro");
    return { ok: msg };
  } catch (e) {
    await scoroLog("in", "prices", false, errText(e));
    return { error: errText(e) };
  }
}

export async function retryScoroTasks(): Promise<void> {
  await requireAdmin();
  await db.scoroTask.updateMany({ data: { attempts: 0 } });
  revalidatePath("/admin/scoro");
}
