import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { currentCustomer, currentOrGuestCustomer } from "@/lib/customer-auth";
import { relativeTime } from "@/lib/products";
import { logoutCustomerAction } from "@/actions/account";
import { SiteHeader } from "@/components/site/Header";
import { NewCollectionButton } from "@/components/account/NewCollectionForm";
import { SortSelect } from "@/components/catalogue/Filters";
import { cn } from "@/lib/cn";
import { PRODUCT_PLACEHOLDER_IMAGE } from "@/lib/placeholder";

export const metadata: Metadata = { title: "My albums — Simetria LT" };

const SORTS = {
  relevance: { updatedAt: "desc" },
  newest: { createdAt: "desc" },
  name: { name: "asc" },
} as const;

type AlbumCard = {
  id: string;
  href: string;
  name: string;
  count: number;
  updated: string;
  /** up to three product images; missing entries render as empty tiles */
  images: (string | null)[];
  tags: string[];
};

const SAMPLE_ALBUMS: AlbumCard[] = [1, 2, 3].map((n) => ({
  id: `sample-${n}`,
  href: `/account/albums/sample-${n}`,
  name: "Hotel Vilnia refurbishment",
  count: 18,
  updated: "2 days ago",
  images: [PRODUCT_PLACEHOLDER_IMAGE, PRODUCT_PLACEHOLDER_IMAGE, PRODUCT_PLACEHOLDER_IMAGE],
  tags: ["Marset", "Sancal", "Pedrali"],
}));

function Thumb({ url, empty, className }: { url?: string | null; empty?: boolean; className?: string }) {
  const image = empty ? null : url ?? PRODUCT_PLACEHOLDER_IMAGE;
  return (
    <div className={cn("relative overflow-hidden bg-[#f2f2f2]", className)}>
      {image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" className="absolute inset-0 m-auto max-h-[70%] max-w-[85%] object-contain" />
      )}
    </div>
  );
}

// Figma "Wishlist-Collection" (node 4217:47160)
export default async function AlbumsPage({ searchParams }: { searchParams: Promise<{ sort?: string }> }) {
  const signedIn = await currentCustomer();
  const customer = await currentOrGuestCustomer();
  const { sort: rawSort } = await searchParams;
  const sort = (rawSort && rawSort in SORTS ? rawSort : "relevance") as keyof typeof SORTS;

  // Sign-in is not enforced yet: anonymous visitors work as a shared guest account and see the
  // Figma mock collections until they create their first one.
  const own: AlbumCard[] = (
        await db.collection.findMany({
          where: { customerId: customer.id },
          orderBy: SORTS[sort],
          include: {
            items: {
              orderBy: { createdAt: "desc" },
              include: { product: { include: { category: true, images: { orderBy: { sort: "asc" }, take: 2 } } } },
            },
          },
        })
      ).map((c) => ({
        id: c.id,
        href: `/account/albums/${c.id}`,
        name: c.name,
        count: c.items.length,
        updated: relativeTime(c.updatedAt),
        images: c.items.slice(0, 3).map((i) => i.product.images[0]?.url ?? null),
        tags: Array.from(new Set(c.items.map((i) => i.product.brand ?? i.product.category?.name).filter(Boolean))).slice(0, 3) as string[],
      }));
  const collections = own.length ? own : SAMPLE_ALBUMS;
  const saved = own.length ? own.reduce((n, c) => n + c.count, 0) : 42;

  return (
    <div className="flex w-full flex-col bg-cream pb-[120px]">
      <div className="flex w-full flex-col gap-[45px]">
        <section className="flex w-full flex-col border-b border-line">
          <SiteHeader variant="solid" />
          <div className="mx-auto flex w-full max-w-[1440px] flex-col justify-between gap-10 px-4 py-[50px] md:px-10 lg:flex-row lg:items-start">
            <div className="flex flex-col justify-between gap-6 lg:min-h-[176px]">
              <h1 className="text-[56px] font-medium leading-[0.92] tracking-[-0.04em] text-black md:text-[80px] xl:text-[106px]">My albums</h1>
              {signedIn && (
                <form action={logoutCustomerAction} className="flex items-center gap-4 text-[14px] tracking-[-0.04em] text-secondary">
                  <span>{signedIn.name} · {signedIn.email}</span>
                  <button className="underline hover:text-black">Sign out</button>
                </form>
              )}
            </div>
            <div className="flex flex-col gap-6 text-[#2b2b2b] lg:w-[366px]">
              <p className="text-[16px] leading-[1.3] tracking-[-0.04em]">
                Collections organised by project. Like products anywhere on the site and assign them to the right
                collection — or start a new one.
              </p>
              <div className="flex items-center gap-4">
                <div className="flex flex-1 flex-col gap-2">
                  <p className="text-[46px] font-medium leading-none tracking-[-0.04em]">{collections.length}</p>
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

        <section className="mx-auto flex w-full max-w-[1440px] flex-col gap-[45px] px-4 md:px-10">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <SortSelect
              value={sort}
              basePath="/account/albums"
              options={[
                { value: "relevance", label: "Relevance" },
                { value: "newest", label: "Newest" },
                { value: "name", label: "Name" },
              ]}
            />
            <div className="flex items-center gap-5 md:w-[367px]">
              <Link href="/catalogue" className="flex h-[39px] w-[168px] shrink-0 items-center justify-center whitespace-nowrap border border-dark text-center text-[13px] font-medium text-black transition-colors duration-300 hover:bg-dark hover:text-white">
                Browse products
              </Link>
              <NewCollectionButton className="flex-1" />
            </div>
          </div>

          {collections.length === 0 ? (
            <p className="text-[16px] tracking-[-0.04em] text-secondary">
              No collections yet. Create one, then use the heart on any product to save it here.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-x-4 gap-y-12 md:grid-cols-2 xl:grid-cols-3">
              {collections.map((c) => {
                const tags = c.tags;
                return (
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
                      {tags.length > 0 && (
                        <div className="flex flex-wrap gap-3">
                          {tags.map((t) => (
                            <span key={t} className="rounded-full border border-line p-[10px] text-[13px] font-medium leading-none tracking-[-0.04em] text-[#1f1f1f]">{t}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
