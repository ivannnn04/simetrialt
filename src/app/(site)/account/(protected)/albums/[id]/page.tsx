import type { Metadata } from "next";
import { SiteHeader } from "@/components/site/Header";
import { AlbumDetail } from "@/components/account/AlbumDetail";

export const metadata: Metadata = { title: "Collection — Simetria LT" };

// Figma "Collection wishlist Open" (node 4217:46938); albums live in the browser for now.
export default async function CollectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="flex w-full flex-col bg-cream pb-[120px]">
      <SiteHeader variant="solid" />
      <AlbumDetail id={id} />
    </div>
  );
}
