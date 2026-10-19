/** Dictionary branches the admin content editor exposes, with Lithuanian labels. */
export const CONTENT_SECTIONS: { key: string; label: string; hint?: string }[] = [
  { key: "home", label: "Pagrindinis puslapis" },
  { key: "services", label: "Paslaugų kortelės", hint: "Kortelės pagrindiniame ir paslaugų puslapyje" },
  { key: "servicesPage", label: "Paslaugų puslapis" },
  { key: "servicePage", label: "Paslaugos puslapis – bendri tekstai" },
  { key: "servicePages", label: "Paslaugų puslapiai – turinys", hint: "Lietuviškas turinys; angliškas gyvena kode (src/data/services.ts)" },
  { key: "projectsPage", label: "Projektų puslapis" },
  { key: "casePage", label: "Projekto puslapis" },
  { key: "brandsPage", label: "Prekių ženklų puslapiai" },
  { key: "aboutPage", label: "Apie mus" },
  { key: "contactPage", label: "Kontaktų puslapis ir forma" },
  { key: "catalogue", label: "Katalogas" },
  { key: "outlet", label: "Išparduotuvė" },
  { key: "product", label: "Produkto puslapis" },
  { key: "save", label: "Išsaugojimo langas (širdelė)" },
  { key: "albums", label: "Mano albumai" },
  { key: "album", label: "Kolekcijos puslapis ir PDF" },
  { key: "newCollection", label: "Naujos kolekcijos langas" },
  { key: "thankYou", label: "Padėkos puslapis" },
  { key: "letsTalk", label: "„Let’s talk“ sekcija" },
  { key: "footer", label: "Poraštė" },
  { key: "nav", label: "Navigacija ir meniu" },
  { key: "search", label: "Paieška" },
  { key: "terms", label: "Terminai (kategorijos, filtrai, medžiagos)", hint: "Angliškas terminas → vertimas" },
  { key: "meta", label: "SEO (title, description)" },
];

export const sectionLabel = (key: string) => CONTENT_SECTIONS.find((s) => s.key === key)?.label ?? key;
