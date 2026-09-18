import { LetsTalk, ServicesList } from "@/components/site/Sections";
import { ProjectsSlider } from "@/components/home/ProjectsSlider";
import { PROJECT_SLIDES, PROJECT_SLIDES_IMAGE } from "@/data/project-slides";
import { getFeaturedProducts } from "@/lib/products";
import { AboutSection, BrandsSection, Hero, ProductLine } from "@/components/home/HomeSections";
import { ScrollReveal } from "@/components/home/ScrollReveal";

export const dynamic = "force-dynamic";


export default async function HomePage() {
  const cards = await getFeaturedProducts(9);

  return (
    <>
      <Hero />
      <ScrollReveal
        image="/images/home/features.jpg"
        slides={[
          {
            title: "Long-term partnerships",
            text: "Trusted by architects and designers for reliable collaboration, thoughtful guidance, and consistent support across every stage of a project.",
          },
          {
            title: "Single point of accountability",
            text: "One partner sources, specifies, delivers and installs — so schedules, budgets and quality stay under control from concept to handover.",
          },
          {
            title: "Curated brands, honest advice",
            text: "We represent manufacturers we trust and recommend only what fits the project — never what happens to be in stock.",
          },
        ]}
      />
      <ProductLine products={cards} />
      <BrandsSection />
      <ServicesList stack />
      <ProjectsSlider image={PROJECT_SLIDES_IMAGE} slides={PROJECT_SLIDES} />
      <AboutSection />
      <LetsTalk />
    </>
  );
}
