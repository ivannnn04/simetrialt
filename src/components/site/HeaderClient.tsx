"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { CaretIcon, Wordmark } from "@/components/ui/Icons";
import { Photo } from "@/components/ui/Photo";

type MenuGroup = { heading: string; items: string[] };
type Category = { label: string; groups: MenuGroup[] };

// Content of the Products mega-menu (Figma "Header Nav Bar / open menu").
const CATEGORIES: Category[] = [
  {
    label: "Lighting",
    groups: [
      {
        heading: "INDOOR LIGHTING",
        items: [
          "All Lamps", "Pendant Lights", "Ceiling Lights", "Wall Lights", "Table Lights", "Floor Lamps",
          "Recessed Lights", "Spotlights", "Systems", "Profile", "Rechargeable lights",
        ],
      },
      {
        heading: "OUTDOOR LIGHTING",
        items: [
          "Spotlights", "Ceiling lights", "Wall lights", "Bollards", "Recessed lights", "Floor lamps",
          "Pendant lights", "Rechargeable lights",
        ],
      },
    ],
  },
  {
    label: "Furniture",
    groups: [
      { heading: "LIVING", items: ["All Furniture", "Sofas", "Armchairs", "Coffee tables", "Shelving", "Sideboards"] },
      { heading: "DINING & WORK", items: ["Dining tables", "Chairs", "Bar stools", "Desks", "Office chairs"] },
    ],
  },
  {
    label: "Decor (Accessories)",
    groups: [
      { heading: "DECOR", items: ["All Decor", "Mirrors", "Rugs", "Vases & objects", "Textiles", "Wall art"] },
    ],
  },
];

const MENU_CARDS = [
  { title: "Design Icons & Best-Selling Items", image: "/images/menu/icons.jpg", href: "/catalogue" },
  { title: "Special Outlet Pricing & Archives", image: "/images/menu/outlet.jpg", href: "/catalogue" },
];

const LEFT_LINKS = [
  { label: "Services", href: "/services" },
  { label: "Projects", href: "/projects" },
  { label: "Brands", href: "/brands" },
  { label: "Outlet", href: "/catalogue" },
];

const RIGHT_LINKS = [
  { label: "About", href: "/about" },
  { label: "Contacts", href: "/contact" },
  { label: "Search", href: "/catalogue" },
];

export type HeaderAccount = { signedIn: boolean; albums: number; name?: string };

function categoryHref(label: string) {
  return `/catalogue?category=${encodeURIComponent(label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""))}`;
}

type Props = {
  /** overlay: transparent over a dark hero (white text); solid: cream bar with black text. */
  variant?: "overlay" | "solid";
  account?: HeaderAccount;
};

export function HeaderClient({ variant = "solid", account = { signedIn: false, albums: 0 } }: Props) {
  const accountLinks = [
    ...RIGHT_LINKS,
    { label: `My albums (${account.albums})`, href: account.signedIn ? "/account/albums" : "/account/login?next=%2Faccount%2Falbums" },
    { label: account.signedIn ? "Account" : "Sign in", href: account.signedIn ? "/account" : "/account/login" },
  ];
  const [open, setOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [active, setActive] = useState(0);

  const pathname = usePathname();
  const solid = variant === "solid" || open;
  // Figma "Link header": default black/white, hover = underline, active page = accent.
  const isActive = (href: string) => {
    const path = href.split("?")[0];
    return path !== "/" && (pathname === path || pathname.startsWith(`${path}/`));
  };
  const link = (active: boolean) =>
    cn(
      "ul-link flex h-4 items-center gap-1 text-[14px] leading-none tracking-[-0.04em] whitespace-nowrap",
      active ? "text-accent" : solid ? "text-black" : "text-white"
    );

  return (
    <header
      className={cn(
        "z-50 w-full transition-colors duration-300",
        variant === "overlay" ? "absolute left-0 top-0" : "relative",
        solid ? "bg-cream" : "bg-transparent"
      )}
      onMouseLeave={() => setOpen(false)}
    >
      <div className="mx-auto flex h-[76px] w-full max-w-[1440px] items-center justify-between px-4 py-6 md:px-10">
        <nav className="hidden w-[450px] items-center gap-6 lg:flex">
          <button
            type="button"
            onMouseEnter={() => setOpen(true)}
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className={link(open || isActive("/catalogue"))}
          >
            Products
            <CaretIcon className={cn("transition-transform", open && "rotate-180")} />
          </button>
          {LEFT_LINKS.map((l) => (
            <Link key={l.label} href={l.href} className={link(isActive(l.href))} onMouseEnter={() => setOpen(false)}>
              {l.label}
            </Link>
          ))}
        </nav>

        <Link href="/" className={cn("leading-none", solid ? "text-black" : "text-white")} aria-label="Simetria home">
          <Wordmark />
        </Link>

        <nav className="hidden w-[450px] items-center justify-end gap-6 lg:flex">
          {accountLinks.map((l) => (
            <Link key={l.label} href={l.href} className={link(isActive(l.href))} onMouseEnter={() => setOpen(false)}>
              {l.label}
            </Link>
          ))}
        </nav>

        <button
          type="button"
          className={cn("text-[14px] tracking-[-0.04em] lg:hidden", solid ? "text-black" : "text-white")}
          onClick={() => setMobileOpen((v) => !v)}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? "Close" : "Menu"}
        </button>
      </div>

      {/* Products mega-menu — Figma node 4217:46020 */}
      {open && (
        <div className="absolute left-0 right-0 top-[76px] hidden border-t border-line bg-cream lg:block">
          <div className="mx-auto flex max-w-[1440px] items-start justify-between">
            <div className="flex flex-1 items-stretch">
              <div className="flex w-[211px] shrink-0 flex-col gap-6 border-r border-line p-10">
                <p className="text-[16px] leading-[1.3] tracking-[-0.04em] text-secondary">CATEGORY</p>
                <ul className="flex flex-col gap-1.5">
                  {CATEGORIES.map((cat, i) => (
                    <li key={cat.label}>
                      <button
                        type="button"
                        onMouseEnter={() => setActive(i)}
                        onClick={() => setActive(i)}
                        className={cn(
                          "w-full py-2 text-left text-[18px] leading-none tracking-[-0.04em] transition-colors duration-300",
                          i === active ? "font-semibold text-black" : "font-medium text-secondary hover:text-accent"
                        )}
                      >
                        {cat.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
              {CATEGORIES[active].groups.map((group) => (
                <div key={group.heading} className="flex flex-1 flex-col gap-6 border-r border-line p-10">
                  <p className="text-[16px] leading-[1.3] tracking-[-0.04em] text-secondary">{group.heading}</p>
                  <ul className="flex flex-col gap-1.5">
                    {group.items.map((item) => (
                      <li key={item}>
                        <Link
                          href={categoryHref(CATEGORIES[active].label)}
                          onClick={() => setOpen(false)}
                          className="block py-2 text-[18px] font-medium leading-none tracking-[-0.04em] text-black transition-colors duration-300 hover:text-accent"
                        >
                          {item}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div className="flex shrink-0 gap-[10px] px-10 pt-10 pb-10">
              {MENU_CARDS.map((card) => (
                <Link key={card.title} href={card.href} onClick={() => setOpen(false)} className="flex w-[250px] flex-col gap-2">
                  <Photo src={card.image} className="h-[270px] w-full" />
                  <p className="text-[15px] leading-[1.4] tracking-[-0.04em] text-black">{card.title}</p>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {mobileOpen && (
        <div className="absolute left-0 right-0 top-[76px] border-t border-line bg-cream px-4 py-6 lg:hidden">
          <ul className="flex flex-col gap-4 text-[18px] font-medium tracking-[-0.04em] text-black">
            <li><Link href="/catalogue" onClick={() => setMobileOpen(false)}>Products</Link></li>
            {[...LEFT_LINKS, ...accountLinks].map((l) => (
              <li key={l.label}>
                <Link href={l.href} onClick={() => setMobileOpen(false)}>{l.label}</Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </header>
  );
}
