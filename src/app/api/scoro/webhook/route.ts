import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { scoroConfig, isConfigured, scoroCall, scoroLog } from "@/lib/scoro/client";
import { applyScoroQuote, enrichScoroQuote, type ScoroQuote } from "@/lib/scoro/sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/**
 * Scoro posts { entityId, entityType, actorId, entity } here for every subscribed quote event.
 * Scoro does not sign webhooks, so the URL carries a secret token. Always answers 2xx: Scoro does
 * not retry, and errors are kept in the sync log instead.
 */
export async function POST(req: NextRequest) {
  const c = await scoroConfig();
  const token = req.nextUrl.searchParams.get("token") ?? "";
  if (!isConfigured(c) || !c.webhookSecret || !same(token, c.webhookSecret)) return NextResponse.json({ ok: false }, { status: 403 });

  let body: { entityId?: number; entityType?: string; entity?: ScoroQuote } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad json" }, { status: 400 });
  }
  if (String(body.entityType ?? "").toLowerCase() !== "quote" || !body.entityId) return NextResponse.json({ ok: true, ignored: true });

  try {
    // the payload's entity has the view format; fetch it when it is missing or has no lines
    let q = body.entity;
    if ((!q || !Array.isArray(q.lines)) && !q?.is_deleted) q = await scoroCall<ScoroQuote>(c, `quotes/view/${body.entityId}`);
    if (!q) return NextResponse.json({ ok: true });
    q = { ...q, id: Number(q.id ?? body.entityId) };
    if (c.pullQuotes) await scoroLog("in", "quote", true, await applyScoroQuote(c, q));
    if (c.enrichQuotes && !q.is_deleted) await scoroLog("out", "photos", true, await enrichScoroQuote(c, q));
  } catch (e) {
    await scoroLog("in", "quote", false, `Scoro #${body.entityId}: ${e instanceof Error ? e.message : String(e)}`);
  }
  return NextResponse.json({ ok: true });
}
