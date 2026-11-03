import { NextResponse, type NextRequest } from "next/server";
import { syncMailboxes } from "@/lib/mail-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Vercel cron (every 10 minutes): copies new mail with CRM clients from the connected Gmail mailboxes. */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  const fromVercel = (req.headers.get("user-agent") ?? "").startsWith("vercel-cron");
  if (secret ? auth !== `Bearer ${secret}` : !fromVercel) return NextResponse.json({ ok: false }, { status: 401 });
  const summary = await syncMailboxes({ budgetMs: 40_000 });
  return NextResponse.json({ ok: true, summary });
}
