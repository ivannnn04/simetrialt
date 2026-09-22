import type { Metadata } from "next";
import { SiteHeader } from "@/components/site/Header";
import { AlbumsList } from "@/components/account/AlbumsList";

export const metadata: Metadata = { title: "My albums — Simetria LT" };

// Figma "Wishlist-Collection" (node 4217:47160); albums are stored in the browser for now.
export default function AlbumsPage() {
  return (
    <div className="flex w-full flex-col bg-cream pb-[120px]">
      <SiteHeader variant="solid" />
      <AlbumsList />
    </div>
  );
}
