import Link from "next/link";
import { DotButton } from "@/components/ui/Button";
import { MailIcon, PhoneIcon, PinIcon } from "@/components/ui/Icons";
import { FooterLogo } from "@/components/site/FooterLogo";

type Item = { label: string; href: string };
const COLUMNS: { heading: string; items: Item[] }[] = [
  {
    heading: "Products",
    items: [
      { label: "Furniture", href: "/catalogue?category=furniture" },
      { label: "Lighting", href: "/catalogue?category=lighting" },
      { label: "Decor (Accessories)", href: "/catalogue?category=decor" },
      { label: "Outlet", href: "/outlet" },
    ],
  },
  {
    heading: "Services",
    items: [
      { label: "Lighting design & solutions", href: "/services/lighting" },
      { label: "Smart home systems", href: "/services/smart-home" },
      { label: "Bespoke interior solutions", href: "/services/bespoke" },
      { label: "Installation & after-sales support", href: "/services/installation" },
    ],
  },
  {
    heading: "Company",
    items: [
      { label: "Projects", href: "/projects" },
      { label: "Brands", href: "/brands" },
      { label: "About", href: "/about" },
      { label: "Contacts", href: "/contact" },
    ],
  },
  {
    heading: "Social media",
    items: [
      { label: "Instagram", href: "#" },
      { label: "Facebook", href: "#" },
    ],
  },
];

const CONTACTS = [
  { label: "Give us a call", value: "(000) 666 555 444", Icon: PhoneIcon, href: "tel:+000666555444" },
  { label: "Send us an email", value: "info@simetria.com", Icon: MailIcon, href: "mailto:info@simetria.com" },
  { label: "Simetria Showroom", value: "Vilnius, Lithuania", Icon: PinIcon, href: "/contact" },
];

/** Figma "Footer" (node 4263:30197). */
export function SiteFooter() {
  return (
    <footer className="w-full overflow-hidden bg-cream pt-[82px]">
      <div className="mx-auto flex max-w-[1440px] flex-col items-center gap-[76px]">
        <div className="flex w-full flex-col gap-12 px-4 md:px-10 lg:flex-row lg:items-stretch lg:justify-between lg:gap-8">
          <div className="flex flex-col gap-10 lg:w-[490px] lg:shrink-0">
            <div className="flex flex-col gap-4">
              <h2 className="text-[40px] font-medium leading-[1.1] tracking-[-0.04em] text-dark md:text-[52px]">
                Your End-to-End Furnishing Partner
              </h2>
              <p className="max-w-[364px] text-[16px] leading-[1.3] tracking-[-0.04em] text-secondary">
                We source, specify, deliver, and coordinate every stage of your furnishing project.
              </p>
            </div>
            <div>
              <DotButton href="/contact">Get in touch</DotButton>
            </div>
          </div>

          <div className="flex flex-col justify-between gap-10 lg:w-[825px]">
            <div className="grid grid-cols-2 gap-8 md:grid-cols-4 md:gap-4">
              {COLUMNS.map((col) => (
                <div key={col.heading} className="flex flex-col border-l border-line pl-4">
                  <p className="pb-4 text-[12px] leading-none tracking-[-0.04em] text-body">{col.heading}</p>
                  {col.items.map((item) => (
                    <Link
                      key={item.label}
                      href={item.href}
                      className="block py-2 text-[14px] leading-[1.15] tracking-[-0.04em] text-dark"
                    >
                      <span className="ul-text">{item.label}</span>
                    </Link>
                  ))}
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-4 border-l border-line pl-4">
              <p className="text-[12px] leading-none tracking-[-0.04em] text-body">Contact us</p>
              <div className="flex flex-col gap-4 md:flex-row">
                {CONTACTS.map(({ label, value, Icon, href }) => (
                  <Link key={label} href={href} className="group flex w-[218px] items-center gap-2 py-2">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-line text-dark transition-[background-color,border-color,color] duration-500 ease-out group-hover:border-dark group-hover:bg-dark group-hover:text-white">
                      <Icon />
                    </span>
                    <span className="flex flex-col gap-1.5 leading-none tracking-[-0.04em]">
                      <span className="text-[12px] text-body">{label}</span>
                      <span className="text-[16px] font-semibold text-dark transition-colors duration-500 ease-out group-hover:text-accent">{value}</span>
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex w-full flex-col items-center gap-10">
          <div className="w-full px-4 md:px-10">
            <FooterLogo className="block h-auto w-full text-warm" />
          </div>
          <div className="flex w-full items-center justify-between gap-8 border-t border-line px-4 py-6 text-[14px] leading-none text-secondary md:px-10">
            <p className="py-1">© Copyright {new Date().getFullYear()} Simetria</p>
            <div className="flex items-center gap-4">
              <Link href="#" className="ul-link py-1 transition-colors hover:text-dark">Privacy Policy</Link>
              <Link href="#" className="ul-link py-1 transition-colors hover:text-dark">Cookie</Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
