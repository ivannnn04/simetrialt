import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { currentOrGuestCustomer } from "@/lib/customer-auth";
import { toCard } from "@/lib/products";
import { deleteCollection, renameCollection } from "@/actions/collections";
import { SiteHeader } from "@/components/site/Header";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { AlbumTable, type AlbumRow } from "@/components/account/AlbumTable";
import { SAMPLE_CATALOGUE, sampleToCard } from "@/data/sample-catalogue";
import { PRODUCT_PLACEHOLDER_IMAGE } from "@/lib/placeholder";

export const metadata: Metadata = { title: "Collection — Simetria LT" };

/** "Indoor / lighting" style two-line category label. */
const splitCategory = (category: string, typology: string): [string, string] =>
  category.toLowerCase().includes("light") ? ["Indoor", "lighting"] : [category.split(" ")[0], typology.toLowerCase()];

const SAMPLE_NAME = "Hotel Vilnia refurbishment";

// Figma "Collection wishlist Open" (node 4217:46938)
export default async function CollectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const customer = await currentOrGuestCustomer();

  let name = SAMPLE_NAME;
  let rows: AlbumRow[];
  let owned = false;

  if (id.startsWith("sample-")) {
    // Anonymous visitors (and the sample cards on My albums) get the Figma mock album.
    rows = SAMPLE_CATALOGUE.slice(0, 6).map((p, i) => ({
      productId: p.id,
      name: p.name,
      category: p.typology,
      categoryLines: splitCategory(p.category.name, p.typology),
      brand: p.brand,
      priceCents: p.salePriceCents ?? p.priceCents,
      quantity: [6, 2, 4, 1, 3, 2][i] ?? 1,
      note: "",
      href: `/catalogue/${p.id}`,
      image: PRODUCT_PLACEHOLDER_IMAGE,
      card: sampleToCard(p),
    }));
  } else {
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
    owned = true;
    name = collection.name;
    rows = collection.items.map((item) => ({
      productId: item.productId,
      name: item.product.name,
      category: item.product.typology ?? item.product.category?.name ?? "",
      categoryLines: splitCategory(item.product.category?.name ?? "", item.product.typology ?? ""),
      brand: item.product.brand ?? "",
      priceCents: item.product.salePriceCents ?? item.product.priceCents,
      quantity: item.quantity,
      note: item.note,
      href: `/catalogue/${item.product.slug}`,
      image: item.product.images[0]?.url ?? PRODUCT_PLACEHOLDER_IMAGE,
      card: toCard(item.product),
    }));
  }

  return (
    <div className="flex w-full flex-col bg-cream pb-[120px]">
      <div className="flex w-full flex-col gap-[45px]">
        <section className="flex w-full flex-col">
          <SiteHeader variant="solid" />
          <div className="border-b border-[#ddd]">
            <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-8 px-4 py-[50px] md:px-10 lg:flex-row lg:items-end lg:justify-between">
              <div className="flex flex-col gap-[35px]">
                <Breadcrumbs items={[{ label: "My album", href: "/account/albums" }, { label: name }]} />
                <h1 className="max-w-[846px] text-[56px] font-medium leading-[0.92] tracking-[-0.04em] text-black md:text-[80px] xl:text-[106px]">{name}</h1>
              </div>
              {owned && (
                <div className="flex flex-col gap-3 lg:w-[366px]">
                  <form action={renameCollection.bind(null, id)} className="flex gap-2">
                    <input
                      name="name"
                      defaultValue={name}
                      aria-label="Collection name"
                      className="h-[39px] min-w-0 flex-1 border border-line bg-transparent px-3 text-[13px] tracking-[-0.04em] focus:border-dark focus:outline-none"
                    />
                    <button className="border border-dark px-5 text-[13px] font-medium text-black transition-colors duration-300 hover:bg-dark hover:text-white">Rename</button>
                  </form>
                  <form action={deleteCollection.bind(null, id)}>
                    <button className="text-[13px] text-[#fb3b30] underline">Delete collection</button>
                  </form>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-[1440px] px-4 md:px-10">
          <AlbumTable
            collectionId={id}
            collectionName={name}
            customer={{ name: customer.name, email: customer.email }}
            rows={rows}
            readOnly={!owned}
          />
        </section>
      </div>
    </div>
  );
}
