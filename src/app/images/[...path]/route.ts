import { NextResponse, type NextRequest } from "next/server";
import { getSiteImages } from "@/lib/site-images";
import { PLACEHOLDER_IMAGE } from "@/lib/placeholder";

export const dynamic = "force-dynamic";

/**
 * /images/<slot>: the photo chosen in Admin → Svetainės nuotraukos, else the temporary placeholder.
 * A short cache keeps changes visible within a minute.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const slot = (await params).path.join("/");
  const map = await getSiteImages();
  const target = map[slot] ?? PLACEHOLDER_IMAGE;
  if (!target) return new NextResponse("Not found", { status: 404 });
  return NextResponse.redirect(new URL(target, req.nextUrl.origin), { status: 307, headers: { "Cache-Control": "public, max-age=60, s-maxage=60" } });
}
