"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { AlbumTable, type AlbumRow } from "@/components/account/AlbumTable";
import { deleteAlbum, renameAlbum, useAlbums } from "@/lib/albums-store";
import { SAMPLE_CATALOGUE, sampleToCard } from "@/data/sample-catalogue";
import { PRODUCT_PLACEHOLDER_IMAGE } from "@/lib/placeholder";

/** "Indoor / lighting" style two-line category label. */
const splitCategory = (category: string): [string, string] => {
  const c = category.toLowerCase();
  if (c.includes("light") || c.includes("lamp") || c.includes("pendant")) return ["Indoor", "lighting"];
  return ["Furniture", c];
};

const SAMPLE_NAME = "Hotel Vilnia refurbishment";

const SAMPLE_ROWS: AlbumRow[] = SAMPLE_CATALOGUE.slice(0, 6).map((p, i) => ({
  productId: p.id,
  name: p.name,
  category: p.typology,
  categoryLines: splitCategory(p.typology),
  brand: p.brand,
  priceCents: p.salePriceCents ?? p.priceCents,
  quantity: [6, 2, 4, 1, 3, 2][i] ?? 1,
  note: "",
  href: `/catalogue/${p.id}`,
  image: PRODUCT_PLACEHOLDER_IMAGE,
  card: sampleToCard(p),
}));

// Figma "Collection wishlist Open" (node 4217:46938); albums are stored in the browser for now.
export function AlbumDetail({ id }: { id: string }) {
  const router = useRouter();
  const albums = useAlbums();
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setHydrated(true), 0);
    return () => clearTimeout(t);
  }, []);

  const sample = id.startsWith("sample-");
  const album = albums.find((a) => a.id === id);

  const name = sample ? SAMPLE_NAME : (album?.name ?? "");
  const rows: AlbumRow[] = sample
    ? SAMPLE_ROWS
    : (album?.items ?? []).map((item) => ({
        productId: item.product.id,
        name: item.product.name,
        category: item.product.category,
        categoryLines: splitCategory(item.product.category),
        brand: item.product.brand,
        priceCents: item.product.priceCents,
        quantity: item.quantity,
        note: item.note,
        href: item.product.href,
        image: item.product.image ?? PRODUCT_PLACEHOLDER_IMAGE,
        card: {
          id: item.product.id,
          name: item.product.name,
          category: item.product.category,
          price: item.product.price,
          salePrice: item.product.salePrice,
          href: item.product.href,
          image: item.product.image,
        },
      }));

  if (!sample && !album) {
    return (
      <section className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 py-[50px] md:px-10">
        <Breadcrumbs items={[{ label: "My album", href: "/account/albums" }, { label: "Collection" }]} />
        {hydrated && <p className="text-[16px] tracking-[-0.04em] text-secondary">This collection does not exist in this browser.</p>}
      </section>
    );
  }

  return (
    <div className="flex w-full flex-col gap-[45px]">
      <div className="border-b border-[#ddd]">
        <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-8 px-4 py-[50px] md:px-10 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-col gap-[35px]">
            <Breadcrumbs items={[{ label: "My album", href: "/account/albums" }, { label: name }]} />
            <h1 className="max-w-[846px] text-[56px] font-medium leading-[0.92] tracking-[-0.04em] text-black md:text-[80px] xl:text-[106px]">{name}</h1>
          </div>
          {album && (
            <div className="flex flex-col gap-3 lg:w-[366px]">
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const value = new FormData(e.currentTarget).get("name");
                  if (typeof value === "string") renameAlbum(album.id, value);
                }}
              >
                <input
                  name="name"
                  key={album.name}
                  defaultValue={album.name}
                  aria-label="Collection name"
                  className="h-[39px] min-w-0 flex-1 border border-line bg-transparent px-3 text-[13px] tracking-[-0.04em] focus:border-dark focus:outline-none"
                />
                <button className="border border-dark px-5 text-[13px] font-medium text-black transition-colors duration-300 hover:bg-dark hover:text-white">Rename</button>
              </form>
              <button
                type="button"
                onClick={() => {
                  deleteAlbum(album.id);
                  router.push("/account/albums");
                }}
                className="self-start text-[13px] text-[#fb3b30] underline"
              >
                Delete collection
              </button>
            </div>
          )}
        </div>
      </div>

      <section className="mx-auto w-full max-w-[1440px] px-4 md:px-10">
        <AlbumTable collectionId={id} collectionName={name} customer={null} rows={rows} readOnly={sample} />
      </section>
    </div>
  );
}
