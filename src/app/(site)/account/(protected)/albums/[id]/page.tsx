import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireCustomer } from "@/lib/customer-auth";
import { relativeTime, toCard } from "@/lib/products";
import { deleteCollection, removeFromCollection, renameCollection } from "@/actions/collections";
import { SiteHeader } from "@/components/site/Header";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { ProductCard } from "@/components/catalogue/ProductCard";
import { StrokeLink } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Collection — Simetria LT" };

export default async function CollectionPage({ params }: { params: Promise<{ id: string }> }) {
  const customer = await requireCustomer();
  const { id } = await params;
  const collection = await db.collection.findFirst({
    where: { id, customerId: customer.id },
    include: {
      items: {
        orderBy: { createdAt: "desc" },
        include: { product: { include: { category: true, images: { orderBy: { sort: "asc" }, take: 2 } } } },
      },
    },
  });
  if (!collection) notFound();

  return (
    <div className="flex w-full flex-col gap-[120px] bg-cream">
      <div className="flex w-full flex-col gap-[45px]">
        <section className="flex w-full flex-col border-b border-line">
          <SiteHeader variant="solid" />
          <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-8 px-4 py-[50px] md:px-10 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-col gap-6">
              <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "My albums", href: "/account/albums" }, { label: collection.name }]} />
              <h1 className="text-[48px] font-medium leading-[0.92] tracking-[-0.04em] text-black md:text-[72px] xl:text-[96px]">{collection.name}</h1>
              <p className="flex gap-3 text-[14px] font-medium tracking-[-0.04em]">
                <span className="text-[#1f1f1f]">{collection.items.length} Products</span>
                <span className="text-secondary">Upt. {relativeTime(collection.updatedAt)}</span>
              </p>
            </div>
            <div className="flex flex-col gap-3 lg:w-[366px]">
              <form action={renameCollection.bind(null, collection.id)} className="flex gap-2">
                <input
                  name="name"
                  defaultValue={collection.name}
                  className="h-[38px] min-w-0 flex-1 border border-line bg-transparent px-3 text-[13px] tracking-[-0.04em] focus:border-dark focus:outline-none"
                />
                <button className="border border-dark px-5 py-[11px] text-[13px] font-medium text-black hover:bg-white">Rename</button>
              </form>
              <form action={deleteCollection.bind(null, collection.id)}>
                <button className="text-[13px] text-[#fb3b30] underline">Delete collection</button>
              </form>
            </div>
          </div>
        </section>

        <section className="mx-auto flex w-full max-w-[1440px] flex-col gap-10 px-4 md:px-10">
          {collection.items.length === 0 ? (
            <div className="flex flex-col items-start gap-6">
              <p className="text-[16px] tracking-[-0.04em] text-secondary">This collection is empty. Save products from the catalogue with the heart icon.</p>
              <StrokeLink href="/catalogue">Browse products</StrokeLink>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {collection.items.map((item) => (
                <div key={item.id} className="flex flex-col gap-3">
                  <ProductCard product={toCard(item.product)} className="h-[420px] lg:h-[449px]" />
                  <form action={removeFromCollection.bind(null, collection.id, item.productId)} className="flex justify-end">
                    <button className="text-[13px] tracking-[-0.04em] text-secondary underline hover:text-[#fb3b30]">Remove from collection</button>
                  </form>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
