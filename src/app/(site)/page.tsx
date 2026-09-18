import { LetsTalk, ProjectsSection, ServicesList } from "@/components/site/Sections";
import { getFeaturedProducts } from "@/lib/products";
import { AboutSection, BrandsSection, Hero, ProductLine } from "@/components/home/HomeSections";
import { ScrollReveal } from "@/components/home/ScrollReveal";

export const dynamic = "force-dynamic";


export default async function HomePage() {
  const cards = await getFeaturedProducts();

  return (
    <>
      <Hero />
      <ScrollReveal
        image="/images/home/features.jpg"
        feature={{
          title: "Long-term partnerships",
          text: "Trusted by architects and designers for reliable collaboration, thoughtful guidance, and consistent support across every stage of a project.",
        }}
      />
      <ProductLine products={cards} />
      <BrandsSection />
      <ServicesList />
      <ProjectsSection />
      <AboutSection />
      <LetsTalk />
    </>
  );
}
