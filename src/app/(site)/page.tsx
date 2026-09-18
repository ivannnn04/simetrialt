import { LetsTalk, ServicesList } from "@/components/site/Sections";
import { ProjectsSlider } from "@/components/home/ProjectsSlider";
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
      <ProjectsSlider
        image="/images/projects/prusta.jpg"
        slides={[
          {
            category: "Apartment",
            title: "PRUSTA Jogailos butas",
            text: "Lighting project development, calculations and compliance, smart lighting integration and custom fixtures, from concept through to handover.",
            info: [
              ["Location", "Vilnius"],
              ["Duration", "22 month"],
              ["Year", "2026"],
              ["Rooms", "140"],
            ],
          },
          {
            category: "Hotel",
            title: "Grand Hotel Kempinski suites",
            text: "Full furniture and lighting specification for 120 suites, sourced from six brands and delivered in three phases without a single day of downtime.",
            info: [
              ["Location", "Vilnius"],
              ["Duration", "14 month"],
              ["Year", "2025"],
              ["Rooms", "120"],
            ],
          },
          {
            category: "Office",
            title: "Quadrum business centre",
            text: "Workplace furniture, acoustic solutions and a custom lighting scheme for 4,000 m² of open-plan and meeting space, installed over one summer.",
            info: [
              ["Location", "Vilnius"],
              ["Duration", "9 month"],
              ["Year", "2024"],
              ["Area", "4 000 m²"],
            ],
          },
        ]}
      />
      <AboutSection />
      <LetsTalk />
    </>
  );
}
