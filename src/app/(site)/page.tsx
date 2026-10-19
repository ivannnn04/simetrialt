import { LetsTalk, ServicesList } from "@/components/site/Sections";
import { ProjectsSlider } from "@/components/home/ProjectsSlider";
import { getSlides } from "@/lib/site-content";
import { getT } from "@/i18n/server";
import { getFeaturedProducts } from "@/lib/products";
import { AboutSection, BrandsSection, Hero, ProductLine } from "@/components/home/HomeSections";
import { ScrollReveal } from "@/components/home/ScrollReveal";

export const dynamic = "force-dynamic";


export default async function HomePage() {
  const [cards, t, slidesData] = await Promise.all([getFeaturedProducts(9), getT(), getSlides()]);

  return (
    <>
      <Hero />
      <ScrollReveal image="/images/home/features.jpg" slides={t.home.features} />
      <ProductLine products={cards} />
      <BrandsSection />
      <ServicesList stack />
      <ProjectsSlider image={slidesData.image} slides={t.home.projects.slides} cta={{ label: t.home.projects.cta, href: "/projects" }} />
      <AboutSection />
      <LetsTalk />
    </>
  );
}
