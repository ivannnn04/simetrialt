import { LetsTalk, ProjectsSection, ServicesList } from "@/components/site/Sections";
import { getFeaturedProducts } from "@/lib/products";
import {
  AboutSection,
  BrandsSection,
  FeaturesSection,
  Hero,
  ProductLine,
  WhySection,
} from "@/components/home/HomeSections";

export const dynamic = "force-dynamic";


export default async function HomePage() {
  const cards = await getFeaturedProducts();

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
