import { scoroConfig } from "@/lib/scoro/client";

export const dynamic = "force-dynamic";

/** Scoro checks this file in the domain root before it accepts a webhook URL on the domain. */
export async function GET() {
  const c = await scoroConfig();
  return new Response(c.domainToken || "scoro", { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
