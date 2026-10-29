import { db } from "@/lib/db";

/**
 * Site photos that are not products or projects (home, services, about, contact, menu).
 * Pages reference fixed paths like /images/home/hero.jpg; /images/[...path] serves the photo chosen
 * in Admin → Svetainės nuotraukos, or the temporary placeholder while a slot is empty.
 */
export const SITE_IMAGES_KEY = "site:images";

export type ImageSlot = { path: string; label: string };

export const IMAGE_SLOTS: { group: string; slots: ImageSlot[] }[] = [
  {
    group: "Pagrindinis puslapis",
    slots: [
      { path: "home/hero.jpg", label: "Hero (viršus)" },
      { path: "home/why.jpg", label: "„Kodėl architektai“ kortelė" },
      { path: "home/features.jpg", label: "„Ilgalaikės partnerystės“ fonas" },
      { path: "projects/prusta.jpg", label: "Projektų slankiklis (PRUSTA)" },
      { path: "home/about.jpg", label: "„Apie mus“ sekcija" },
    ],
  },
  {
    group: "Paslaugos",
    slots: [
      { path: "services/hero.jpg", label: "Paslaugų puslapio hero" },
      { path: "services/lighting.jpg", label: "Kortelė: apšvietimo projektavimas" },
      { path: "services/smart-home.jpg", label: "Kortelė: išmanieji namai" },
      { path: "services/bespoke.jpg", label: "Kortelė: individualūs interjero sprendimai" },
      { path: "services/installation.jpg", label: "Kortelė: montavimas ir aptarnavimas" },
      { path: "services/process-1.jpg", label: "Proceso kortelė 01" },
      { path: "services/process-2.jpg", label: "Proceso kortelė 02" },
      { path: "services/process-3.jpg", label: "Proceso kortelė 03" },
      { path: "services/process-4.jpg", label: "Proceso kortelė 04" },
      { path: "services/cta.jpg", label: "Paslaugų CTA" },
      ...(["lighting", "smart-home", "bespoke", "installation"] as const).flatMap((s) => [
        { path: `services/${s}/hero.jpg`, label: `${s}: hero` },
        { path: `services/${s}/overview.jpg`, label: `${s}: apžvalga (didelė)` },
        { path: `services/${s}/overview-small.jpg`, label: `${s}: apžvalga (maža)` },
        { path: `services/${s}/stages.jpg`, label: `${s}: etapų juosta` },
      ]),
    ],
  },
  {
    group: "Apie mus",
    slots: [
      { path: "about/hero.jpg", label: "Hero" },
      { path: "about/features.jpg", label: "„Personalizuotas požiūris“" },
      { path: "about/cta.jpg", label: "CTA miniatiūra" },
      { path: "about/banner.jpg", label: "Reklaminė juosta" },
      ...Array.from({ length: 8 }, (_, i) => ({ path: `about/team-${i + 1}.jpg`, label: `Komanda ${i + 1}` })),
    ],
  },
  {
    group: "Kita",
    slots: [
      { path: "contact/hero.jpg", label: "Kontaktų puslapis" },
      { path: "menu/icons.jpg", label: "Meniu kortelė: dizaino ikonos" },
      { path: "menu/outlet.jpg", label: "Meniu kortelė: išpardavimas" },
    ],
  },
];

export const ALL_SLOTS = IMAGE_SLOTS.flatMap((g) => g.slots.map((s) => s.path));

/** Read straight from the database (no in-memory cache): a change shows up on the next request. */
export async function getSiteImages(): Promise<Record<string, string>> {
  try {
    const row = await db.setting.findUnique({ where: { key: SITE_IMAGES_KEY } });
    return row ? (JSON.parse(row.value) as Record<string, string>) : {};
  } catch {
    return {};
  }
}
