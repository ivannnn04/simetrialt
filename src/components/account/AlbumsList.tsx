"use client";

import { useState } from "react";
import Link from "next/link";
import { NewCollectionButton } from "@/components/account/NewCollectionForm";
import { relativeTime, useAlbums } from "@/lib/albums-store";
import { cn } from "@/lib/cn";
import { PRODUCT_PLACEHOLDER_IMAGE } from "@/lib/placeholder";

type AlbumCard = {
  id: string;
  href: string;
  name: string;
  count: number;
  updated: string;
  images: (string | null)[];
  tags: string[];
  createdAt: number;
  updatedAt: number;
};

const SAMPLE_ALBUMS: AlbumCard[] = [1, 2, 3].map((n) => ({
  id: `sample-${n}`,
  href: `/account/albums/sample-${n}`,
  name: "Hotel Vilnia refurbishment",
  count: 18,
  updated: "2 days ago",
  images: [PRODUCT_PLACEHOLDER_IMAGE, PRODUCT_PLACEHOLDER_IMAGE, PRODUCT_PLACEHOLDER_IMAGE],
  tags: ["Marset", "Sancal", "Pedrali"],
  createdAt: 0,
  updatedAt: 0,
}));

const SORTS = [
  { value: "relevance", label: "Relevance" },
  { value: "newest", label: "Newest" },
  { value: "name", label: "Name" },
] as const;
type Sort = (typeof SORTS)[number]["value"];

function Thumb({ url, empty, className }: { url?: string | null; empty?: boolean; className?: string }) {
  const image = empty ? null : (url ?? PRODUCT_PLACEHOLDER_IMAGE);
  return (
    <div className={cn("relative overflow-hidden bg-[#f2f2f2]", className)}>
      {image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" className="absolute inset-0 m-auto max-h-[70%] max-w-[85%] object-contain" />
      )}
    </div>
  );
}

// Figma "Wishlist-Collection" (node 4217:47160); albums are stored in the browser for now.
export function AlbumsList() {
  const albums = useAlbums();
  const [sort, setSort] = useState<Sort>("relevance");

  const own: AlbumCard[] = albums.map((a) => ({
    id: a.id,
    href: `/account/albums/${a.id}`,
    name: a.name,
    count: a.items.length,
    updated: relativeTime(a.updatedAt),
    images: a.items.slice(0, 3).map((i) => i.product.image ?? null),
    tags: Array.from(new Set(a.items.map((i) => i.product.brand || i.product.category).filter(Boolean))).slice(0, 3),
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  }));
  const list = own.length ? own : SAMPLE_ALBUMS;
  const sorted = [...list].sort((a, b) =>
    sort === "name" ? a.name.localeCompare(b.name) : sort === "newest" ? b.createdAt - a.createdAt : b.updatedAt - a.updatedAt
  );
  const saved = own.length ? own.reduce((n, c) => n + c.count, 0) : 42;

  return (
    <>
      <section className="flex w-full flex-col border-b border-line">
        <div className="mx-auto flex w-full max-w-[1440px] flex-col justify-between gap-10 px-4 py-[50px] md:px-10 lg:flex-row lg:items-start">
          <div className="flex flex-col justify-between gap-6 lg:min-h-[176px]">
            <h1 className="text-[56px] font-medium leading-[0.92] tracking-[-0.04em] text-black md:text-[80px] xl:text-[106px]">My albums</h1>
          </div>
          <div className="flex flex-col gap-6 text-[#2b2b2b] lg:w-[366px]">
            <p className="text-[16px] leading-[1.3] tracking-[-0.04em]">
              Collections organised by project. Like products anywhere on the site and assign them to the right
              collection — or start a new one.
            </p>
            <div className="flex items-center gap-4">
              <div className="flex flex-1 flex-col gap-2">
                <p className="text-[46px] font-medium leading-none tracking-[-0.04em]">{list.length}</p>
                <p className="text-[16px] uppercase leading-[1.3] tracking-[-0.04em]">Collections</p>
              </div>
              <div className="flex flex-1 flex-col gap-2">
                <p className="text-[46px] font-medium leading-none tracking-[-0.04em]">{saved}</p>
                <p className="text-[16px] uppercase leading-[1.3] tracking-[-0.04em]">Products saved</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto mt-[45px] flex w-full max-w-[1440px] flex-col gap-[45px] px-4 md:px-10">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <label className="flex items-center gap-2 text-[15px]">
            <span className="text-[#1a1c18]/60">Sort by</span>
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="bg-transparent text-[#1a1c18] focus:outline-none">
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-center gap-5 md:w-[367px]">
            <Link
              href="/catalogue"
              className="flex h-[39px] w-[168px] shrink-0 items-center justify-center whitespace-nowrap border border-dark text-center text-[13px] font-medium text-black transition-colors duration-300 hover:bg-dark hover:text-white"
            >
              Browse products
            </Link>
            <NewCollectionButton className="flex-1" />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-x-4 gap-y-12 md:grid-cols-2 xl:grid-cols-3">
          {sorted.map((c) => (
            <Link key={c.id} href={c.href} className="group flex flex-col gap-7">
              <div className="flex items-center gap-1">
                <Thumb url={c.images[0]} empty={c.images.length < 1} className="h-[378px] flex-[270]" />
                <div className="flex flex-[169] flex-col gap-1">
                  <Thumb url={c.images[1]} empty={c.images.length < 2} className="h-[187px]" />
                  <Thumb url={c.images[2]} empty={c.images.length < 3} className="h-[187px]" />
                </div>
              </div>
              <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-[10px] font-medium leading-[1.3]">
                  <p className="text-[20px] tracking-[-0.04em] text-[#1b2a41] transition-colors duration-300 group-hover:text-accent">{c.name}</p>
                  <p className="flex gap-3 text-[14px] tracking-[-0.04em]">
                    <span className="text-[#1f1f1f]">{c.count} Products</span>
                    <span className="text-secondary">Upt. {c.updated}</span>
                  </p>
                </div>
                {c.tags.length > 0 && (
                  <div className="flex flex-wrap gap-3">
                    {c.tags.map((t) => (
                      <span key={t} className="rounded-full border border-line p-[10px] text-[13px] font-medium leading-none tracking-[-0.04em] text-[#1f1f1f]">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
