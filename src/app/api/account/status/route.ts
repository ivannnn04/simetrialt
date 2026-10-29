import { NextResponse } from "next/server";
import { currentCustomer } from "@/lib/customer-auth";

export const dynamic = "force-dynamic";

/** Who is browsing: lets client components (heart button, header) know whether a customer is signed in. */
export async function GET() {
  const c = await currentCustomer();
  return NextResponse.json(c ? { signedIn: true, id: c.id, name: c.name } : { signedIn: false }, { headers: { "Cache-Control": "no-store" } });
}
