import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { markNotificationsSeen, notificationsFor } from "@/lib/notifications";

export const dynamic = "force-dynamic";

/** The bell polls this: unread count and the latest inquiries. */
export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(await notificationsFor(user), { headers: { "Cache-Control": "no-store" } });
}

/** Opening the bell marks everything up to now as read. */
export async function POST() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await markNotificationsSeen(user.id);
  return NextResponse.json({ ok: true });
}
