import type { Metadata } from "next";
import { SiteHeader } from "@/components/site/Header";
import { AlbumsList } from "@/components/account/AlbumsList";
import { getT } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).albums.meta };
}

// Figma "Wishlist-Collection" (node 4217:47160); albums are stored in the browser for now.
export default function AlbumsPage() {
  return (
    <div className="flex w-full flex-col bg-cream pb-10 md:pb-[120px]">
      <SiteHeader variant="solid" />
      <AlbumsList />
    </div>
  );
}
