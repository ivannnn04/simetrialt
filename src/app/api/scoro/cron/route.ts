import { NextResponse, type NextRequest } from "next/server";
import { scoroConfig, isConfigured, scoroLog } from "@/lib/scoro/client";
import { pullPrices, runSync } from "@/lib/scoro/sync";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Daily Vercel cron: sends whatever is still waiting and pulls Scoro price changes. */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  const fromVercel = (req.headers.get("user-agent") ?? "").startsWith("vercel-cron");
  if (secret ? auth !== `Bearer ${secret}` : !fromVercel) return NextResponse.json({ ok: false }, { status: 401 });
  const c = await scoroConfig();
  if (!isConfigured(c)) return NextResponse.json({ ok: true, skipped: "not configured" });
  const sync = await runSync(200_000);
  let prices = "";
  if (c.pullPrices) {
    try {
      prices = await pullPrices(c, 80_000);
      await scoroLog("in", "prices", true, prices);
    } catch (e) {
      await scoroLog("in", "prices", false, e instanceof Error ? e.message : String(e));
    }
  }
  return NextResponse.json({ ok: true, sync, prices });
}
