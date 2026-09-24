import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site/Header";
import { Photo } from "@/components/ui/Photo";
import { MailIcon, PhoneIcon, PinIcon } from "@/components/ui/Icons";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { ContactSection } from "@/components/contact/ContactSection";

export const metadata: Metadata = {
  title: "Contact — Simetria LT",
  description: "Connect with Simetria's team of experts in bespoke lighting and interior solutions.",
};

const CONTACTS = [
  { label: "Give us a call", value: "(000) 666 555 444", Icon: PhoneIcon, href: "tel:+000666555444" },
  { label: "Send us an email", value: "info@simetria.com", Icon: MailIcon, href: "mailto:info@simetria.com" },
  { label: "Simetria Showroom", value: "Vilnius, Lithuania", Icon: PinIcon, href: "#" },
];

const TICKER = "Let’s Collaborate • Get in Touch • Start Your Project • ";

// Figma "Contact" (node 4217:46337)
export default async function ContactPage({ searchParams }: { searchParams: Promise<{ product?: string }> }) {
  const { product } = await searchParams;
  return (
    <>
      <section className="flex w-full flex-col gap-16 bg-cream lg:gap-[100px]">
        <SiteHeader variant="solid" />
        <div className="flex w-full flex-col gap-10">
          <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-10 px-4 md:px-10 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-col gap-6 lg:w-[500px]">
              <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Contact" }]} />
              <div className="flex flex-col gap-4">
                <h1 className="text-[56px] font-medium leading-[0.92] tracking-[-0.04em] text-black md:text-[80px] xl:text-[105px]">Contact</h1>
                <p className="text-[15px] leading-[1.4] tracking-[-0.04em] text-body">
                  Connect with Simetria’s team of experts in bespoke lighting and interior solutions. We’re eager to
                  collaborate, share knowledge, and bring your vision to life.
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-4 md:flex-row md:items-center">
              {CONTACTS.map(({ label, value, Icon, href }) => (
                <Link key={label} href={href} className="group flex items-center gap-[10px] py-2 md:w-[216px]">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-line text-ink transition-[background-color,border-color,color] duration-500 ease-out group-hover:border-dark group-hover:bg-dark group-hover:text-white">
                    <Icon />
                  </span>
                  <span className="flex flex-col gap-1 leading-none">
                    <span className="text-[12px] tracking-[-0.04em] text-secondary">{label}</span>
                    <span className="text-[16px] font-semibold tracking-[-0.04em] text-ink transition-colors duration-500 ease-out group-hover:text-accent">{value}</span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
          <Photo src="/images/contact/hero.jpg" position="bottom" className="h-[360px] w-full sm:h-[420px] md:h-[480px] xl:aspect-[1440/512] xl:h-auto xl:min-h-[480px]" />
        </div>
      </section>

      <section className="flex w-full flex-col overflow-hidden pt-[120px]">
        <div className="flex whitespace-nowrap" aria-hidden>
          <p className="ticker text-[64px] leading-[0.92] tracking-[-0.04em] text-[#393939] md:text-[143px]">
            {TICKER}{TICKER}
          </p>
        </div>
        <ContactSection initialMessage={product ? `Hello, I am interested in “${product}”.\n` : ""} />
      </section>
    </>
  );
}
