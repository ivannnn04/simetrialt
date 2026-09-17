import { db } from "@/lib/db";
import { formatPrice } from "@/lib/slug";
import { LetsTalk, ProjectsSection, ServicesList } from "@/components/site/Sections";
import {
  AboutSection,
  BrandsSection,
  FeaturesSection,
  Hero,
  ProductLine,
  WhySection,
  type ProductCardData,
} from "@/components/home/HomeSections";

export const dynamic = "force-dynamic";

// Placeholder cards from the Figma mock, used until the catalogue has three published products.
const SAMPLE_PRODUCTS: ProductCardData[] = [
  { name: "n35", category: "Lighting", price: "$5,000", href: "/catalogue" },
  { name: "Okha Repose sofa", category: "Sofas", price: "$5,000", href: "/catalogue" },
  { name: "Okha Repose", category: "Tables", price: "$5,000", href: "/catalogue" },
];

export default async function HomePage() {
  const products = await db.product.findMany({
    where: { published: true },
    orderBy: { updatedAt: "desc" },
    take: 3,
    include: { category: true, images: { orderBy: { sort: "asc" }, take: 1 } },
  });

  const cards: ProductCardData[] = products.map((p) => ({
    name: p.name,
    category: p.category?.name ?? "",
    price: formatPrice(p.priceCents, p.currency),
    href: `/catalogue/${p.slug}`,
    image: p.images[0]?.url ?? null,
  }));
  while (cards.length < 3) cards.push(SAMPLE_PRODUCTS[cards.length]);

  return (
    <>
      <Hero />
      <WhySection />
      <FeaturesSection />
      <ProductLine products={cards} />
      <BrandsSection />
      <ServicesList />
      <ProjectsSection />
      <AboutSection />
      <LetsTalk />
    </>
  );
}
