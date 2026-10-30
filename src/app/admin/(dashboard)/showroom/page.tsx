import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { formatPrice } from "@/lib/slug";
import { attrsOf, deriveVariant } from "@/lib/variants";
import { splitDescription } from "@/lib/product-page";
import { ShowroomCatalogue, type ShowroomItem } from "@/components/admin/ShowroomCatalogue";

export const dynamic = "force-dynamic";

/**
 * Catalogue for showing clients in the showroom: big cards, one per design (variants grouped),
 * opening into a full-screen view with large photos, options, price and specifications.
 */
export default async function ShowroomPage() {
  await requireUser();
  const products = await db.product.findMany({
    where: { published: true },
    orderBy: [{ inShowroom: "desc" }, { updatedAt: "desc" }],
    include: { category: true, images: { orderBy: { sort: "asc" }, take: 8 } },
    take: 2000,
  });

  const groups = new Map<string, typeof products>();
  for (const p of products) {
    const key = p.groupKey ?? deriveVariant(p).groupKey;
    groups.set(key, [...(groups.get(key) ?? []), p]);
  }

  const items: ShowroomItem[] = [...groups.values()].map((members) => {
    const first = members[0];
    const price = (m: (typeof members)[number]) => (m.salePriceCents != null && m.salePriceCents < m.priceCents ? m.salePriceCents : m.priceCents);
    const min = Math.min(...members.map(price));
    return {
      id: first.id,
      name: deriveVariant(first).baseName || first.name,
      brand: first.brand ?? "",
      category: first.category?.name ?? "",
      typology: first.typology ?? "",
      inShowroom: members.some((m) => m.inShowroom),
      price: min > 0 ? `${members.length > 1 && members.some((m) => price(m) !== min) ? "nuo " : ""}${formatPrice(min, first.currency)}` : "",
      image: members.flatMap((m) => m.images.map((i) => i.url))[0] ?? null,
      variants: members.map((m) => {
        const attrs = Object.keys(attrsOf(m.variantAttrs)).length ? attrsOf(m.variantAttrs) : deriveVariant(m).attrs;
        const split = splitDescription(m.description ?? "", m.material ?? "");
        const onSale = m.salePriceCents != null && m.salePriceCents < m.priceCents;
        return {
          id: m.id,
          slug: m.slug,
          sku: m.sku ?? "",
          label: m.variantLabel || Object.values(attrs).join(", ") || m.name,
          images: m.images.map((i) => i.url),
          price: m.priceCents > 0 ? formatPrice(onSale ? m.salePriceCents! : m.priceCents, m.currency) : "",
          oldPrice: onSale ? formatPrice(m.priceCents, m.currency) : "",
          description: split.description.slice(0, 1200),
          details: split.details.slice(0, 8),
        };
      }),
    };
  });

  return <ShowroomCatalogue items={items} />;
}
