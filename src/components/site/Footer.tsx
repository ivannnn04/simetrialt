import Link from "@/components/ui/Link";
import { DotButton } from "@/components/ui/Button";
import { MailIcon, PhoneIcon, PinIcon } from "@/components/ui/Icons";
import { FooterLogo } from "@/components/site/FooterLogo";
import { cn } from "@/lib/cn";
import { getT } from "@/i18n/server";
import type { Dictionary } from "@/i18n/dictionaries";
import { getContacts, type SiteContacts } from "@/lib/site-content";

type Item = { label: string; href: string };
const columns = (t: Dictionary, c: SiteContacts): { heading: string; items: Item[] }[] => [
  {
    heading: t.footer.columns.products,
    items: [
      { label: t.footer.products.furniture, href: "/catalogue?category=furniture" },
      { label: t.footer.products.lighting, href: "/catalogue?category=lighting" },
      { label: t.footer.products.decor, href: "/catalogue?category=decor" },
      { label: t.footer.products.outlet, href: "/outlet" },
    ],
  },
  {
    heading: t.footer.columns.services,
    items: [
      { label: t.footer.services.lighting, href: "/services/lighting" },
      { label: t.footer.services.smartHome, href: "/services/smart-home" },
      { label: t.footer.services.bespoke, href: "/services/bespoke" },
      { label: t.footer.services.installation, href: "/services/installation" },
    ],
  },
  {
    heading: t.footer.columns.company,
    items: [
      { label: t.footer.company.projects, href: "/projects" },
      { label: t.footer.company.brands, href: "/brands" },
      { label: t.footer.company.about, href: "/about" },
      { label: t.footer.company.contacts, href: "/contact" },
    ],
  },
  {
    heading: t.footer.columns.social,
    items: [
      { label: "Instagram", href: c.instagram || "#" },
      { label: "Facebook", href: c.facebook || "#" },
      { label: "LinkedIn", href: c.linkedin || "#" },
    ],
  },
];

const contacts = (t: Dictionary, c: SiteContacts) => [
  { label: t.footer.call, value: c.phone, Icon: PhoneIcon, href: c.phoneHref },
  { label: t.footer.email, value: c.email, Icon: MailIcon, href: `mailto:${c.email}` },
  { label: t.footer.showroom, value: t.footer.showroomValue, Icon: PinIcon, href: "/contact" },
];

/** Figma "Footer" (node 4263:30197; Lithuanian variant 4263:48375). */
export async function SiteFooter() {
  const [t, site] = await Promise.all([getT(), getContacts()]);
  const COLUMNS = columns(t, site);
  const CONTACTS = contacts(t, site);
  return (
    <footer className="w-full overflow-hidden bg-cream pt-[82px]">
      <div className="mx-auto flex max-w-[1440px] flex-col items-center gap-[76px]">
        <div className="flex w-full flex-col gap-12 px-4 md:px-10 lg:flex-row lg:items-stretch lg:justify-between lg:gap-8">
          <div className="flex flex-col gap-10 lg:w-[490px] lg:shrink lg:basis-[490px]">
            <div className="flex flex-col gap-4">
              <h2 className="text-[40px] font-medium leading-[1.1] tracking-[-0.04em] text-dark md:text-[52px]">
                {t.footer.title}
              </h2>
              <p className="max-w-[364px] text-[16px] leading-[1.3] tracking-[-0.04em] text-secondary">{t.footer.text}</p>
            </div>
            <div>
              <DotButton href="/contact">{t.footer.cta}</DotButton>
            </div>
          </div>

          <div className="flex min-w-0 flex-col justify-between gap-10 lg:max-w-[825px] lg:flex-1">
            <div className="grid grid-cols-2 gap-8 md:grid-cols-4 md:gap-4">
              {COLUMNS.map((col, i) => (
                <div
                  key={col.heading}
                  // phones (2 columns): Company sits next to Products, Services goes to the second row
                  className={cn("flex flex-col border-l border-line pl-4 md:order-none", ["order-1", "order-3", "order-2", "order-4"][i])}
                >
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
              <p className="text-[12px] leading-none tracking-[-0.04em] text-body">{t.footer.contactUs}</p>
              <div className="flex flex-col gap-4 md:flex-row md:flex-wrap">
                {CONTACTS.map(({ label, value, Icon, href }) => (
                  <Link key={label} href={href} className="group flex w-[218px] items-center gap-2 py-2">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-line text-brand transition-[background-color,border-color,color] duration-500 ease-out group-hover:border-dark group-hover:bg-dark group-hover:text-white">
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

        <div className="w-full px-4 md:px-10">
          <FooterLogo className="block h-auto w-full text-warm" />
        </div>
      </div>

      {/* Sign line: full-width rule; phones stack the links over the centred copyright */}
      <div className="mt-10 w-full border-t border-line">
        <div className="mx-auto flex w-full max-w-[1440px] flex-col-reverse items-center gap-4 px-4 py-6 text-center text-[14px] leading-none text-secondary md:flex-row md:justify-between md:gap-8 md:px-10 md:text-left">
          <p className="whitespace-nowrap py-1">{t.footer.copyright(new Date().getFullYear())}</p>
          {/* phones: the two links spread across the full width */}
          <div className="flex w-full items-center justify-between gap-4 md:w-auto md:justify-start">
            <Link href={site.privacyUrl || "#"} className="ul-link whitespace-nowrap py-1 transition-colors hover:text-dark">{t.footer.privacy}</Link>
            <Link href={site.cookieUrl || "#"} className="ul-link py-1 transition-colors hover:text-dark">{t.footer.cookie}</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
