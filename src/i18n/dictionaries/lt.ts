import type { Dictionary } from "@/i18n/dictionaries/en";

/** Lithuanian copy (Figma "Home page / ver 1", node 4217:49850). */
export const lt: Dictionary = {
  meta: {
    title: "Simetria LT",
    description: "Simetria – baldų ir apšvietimo sprendimai architektams, kuriantiems didelio masto projektus.",
  },
  nav: {
    products: "Produktai",
    services: "Paslaugos",
    projects: "Projektai",
    brands: "Gamintojai",
    outlet: "Išparduotuvė",
    about: "Apie",
    contacts: "Kontaktai",
    search: "Paieška",
    myAlbums: (n) => `Mano albumai (${n})`,
    account: "Krepšelis",
    signIn: "Krepšelis",
    menu: "Meniu",
    closeMenu: "Uždaryti meniu",
    home: "Simetria pradžia",
    category: "KATEGORIJA",
    language: "Kalba",
    cards: {
      icons: "Dizaino ikonos",
      outlet: "Specialios nuolaidos",
    },
  },
  // Figma 4217:49515 (placeholder), 4217:49485 (results), 4217:49500 (no results)
  search: {
    placeholder: "Paieška",
    label: "Ieškoti produktų",
    results: "Paieškos rezultatai",
    empty: "Pagal jūsų užklausą rezultatų nerasta",
  },
  terms: {
    // categories
    lighting: "Šviestuvai",
    furniture: "Baldai",
    "decor (accessories)": "Interjero detalės (aksesuarai)",
    decor: "Dekoras",
    tables: "Stalai",
    // menu groups
    "indoor lighting": "VIDAUS APŠVIETIMAS",
    "outdoor lighting": "LAUKO APŠVIETIMAS",
    living: "SVETAINĖ",
    "dining & work": "VALGOMASIS IR DARBAS",
    // typologies
    "all lamps": "Visi",
    "pendant lights": "Pakabinami šviestuvai",
    "ceiling lights": "Lubiniai",
    "wall lights": "Sieniniai šviestuvai",
    "table lights": "Staliniai",
    "floor lamps": "Toršerai",
    "recessed lights": "Įleidžiami",
    spotlights: "Kryptiniai",
    systems: "Sistemos",
    profile: "Profiliai",
    "rechargeable lights": "Pakraunami",
    bollards: "Stulpeliai",
    "all furniture": "Visi baldai",
    sofas: "Sofos",
    armchairs: "Foteliai",
    "coffee tables": "Kavos staliukai",
    shelving: "Lentynos",
    sideboards: "Komodos",
    "dining tables": "Valgomojo stalai",
    chairs: "Kėdės",
    "bar stools": "Baro kėdės",
    desks: "Rašomieji stalai",
    "office chairs": "Biuro kėdės",
    "all decor": "Visas dekoras",
    mirrors: "Veidrodžiai",
    rugs: "Kilimai",
    "vases & objects": "Vazos ir objektai",
    textiles: "Tekstilė",
    "wall art": "Sienų dekoras",
  },
  home: {
    hero: {
      text: "Kuriame ir įgyvendiname integruotus, aukšto meistriškumo ir intelektualaus dizaino sprendimus, privačios ir komercinės paskirties bei biurų interjerams.",
      explore: "Pažinkite produktus",
      book: "Rezervuokite konsultaciją",
      badge: "Dizaino namai – įkurta architektams",
      title: ["Meistriškų idėjų, holistinių sprendimų ir intelektualaus dizaino namai."],
    },
    why: {
      badge: "Kodėl architektai bendradarbiauja su mumis",
      title: "Viskas, ko architektams reikia iš projektavimo partnerio",
      scroll: "Scroll",
    },
    features: [
      {
        title: "Ilgalaikės partnerystės",
        text: "Architektai ir dizaineriai pasitiki mumis dėl patikimo bendradarbiavimo, išsamaus konsultavimo ir nuolatinės paramos kiekviename projekto etape.",
      },
      {
        title: "Viena atsakomybė",
        text: "Vienas partneris parenka, specifikuoja, pristato ir montuoja – todėl terminai, biudžetas ir kokybė išlieka kontroliuojami nuo koncepcijos iki perdavimo.",
      },
      {
        title: "Atrinkti prekių ženklai, sąžiningi patarimai",
        text: "Atstovaujame gamintojams, kuriais pasitikime, ir rekomenduojame tik tai, kas tinka projektui – o ne tai, kas atsitiktinai yra sandėlyje.",
      },
    ],
    productLine: { title: "Mūsų produktai", cta: "Katalogas" },
    brands: "PREKĖS ŽENKLAI, KURIUOS ATSTOVAUJAME",
    projects: {
      cta: "Susipažinkite su produktais",
      slides: [
        {
          category: "Butas",
          title: "PRUSTA Jogailos butas",
          text: "Apšvietimo projektų kūrimas, skaičiavimai ir atitikties reikalavimams užtikrinimas, išmaniojo apšvietimo integravimas ir individualiai pritaikyti šviestuvai – nuo koncepcijos iki projekto perdavimo.",
          info: [
            ["Vieta", "Vilnius"],
            ["Trukmė", "22 mėn."],
            ["Metai", "2026"],
            ["Kambariai", "140"],
          ],
        },
        {
          category: "Viešbutis",
          title: "Grand Hotel Kempinski apartamentai",
          text: "Pilna baldų ir apšvietimo specifikacija 120 apartamentų – šešių prekių ženklų produktai, pristatyti trimis etapais be nė vienos prastovos dienos.",
          info: [
            ["Vieta", "Vilnius"],
            ["Trukmė", "14 mėn."],
            ["Metai", "2025"],
            ["Kambariai", "120"],
          ],
        },
        {
          category: "Biuras",
          title: "Quadrum verslo centras",
          text: "Darbo vietų baldai, akustiniai sprendimai ir individualus apšvietimo projektas 4 000 m² atviro plano ir posėdžių erdvėms, įrengtas per vieną vasarą.",
          info: [
            ["Vieta", "Vilnius"],
            ["Trukmė", "9 mėn."],
            ["Metai", "2024"],
            ["Plotas", "4 000 m²"],
          ],
        },
      ],
    },
    about: {
      title: "Nepaprastas dizainas. Paprastas įgyvendinimas.",
      button: "Apie mus",
      text: "Nuo atrinktų baldų ir šviestuvų iki individualiai gaminamų sprendimų jūsų erdvei. Padedame išgryninti idėją, suderinti dizainą ir technines detales, organizuojame gamybą, tiekimą bei montavimą. Pasirūpiname visu procesu – nuo sumanymo iki įgyvendinimo.",
      numbers: ["Kambariai", "Projektai", "Gamintojai"],
    },
  },
  services: {
    readMore: "Skaityti daugiau",
    items: {
      lighting: {
        tags: ["Apšvietimo skaičiavimas", "Individualūs tvirtinimo elementai", "Integracija ir palaikymas"],
        title: "Apšvietimo dizainas ir sprendimai",
        text: "Kuriame apšvietimą, kuris sujungia erdvės funkciją, architektūrą ir atmosferą. Rengiame sprendimus privačios ir viešosios paskirties objektams – nuo koncepcijos iki šviestuvų parinkimo ir valdymo scenarijų.",
        points: [
          "Apšvietimo koncepcijos kūrimas",
          "Architektūrinis ir techninis apšvietimas",
          "Dekoratyvinis apšvietimas",
          "Apšvietos skaičiavimai ir analizė",
          "Energetiškai efektyvūs apšvietimo sprendimai",
          "Šviestuvų ir įrangos parinkimas",
          "Apšvietimo valdymo scenarijai ir sistemos: šviesos intensyvumo reguliavimas, scenos ir išmanusis valdymas",
        ],
        cta: "Aptarkime jūsų projektą",
      },
      "smart-home": {
        tags: ["Išmanusis apšvietimas", "Klimato kontrolė", "AV ir apsauga"],
        title: "Išmaniųjų namų sistemos",
        text: "Išmanusis apšvietimas, automatinės langų užuolaidos, apsaugos, klimato kontrolės ir garso / vaizdo sistemos – pilnai suprojektuotos, integruotos ir įdiegtos nuo koncepcijos iki galutinio paleidimo, pritaikytos sklandžiam veikimui, komfortui, saugumui ir intuityviam valdymui.",
      },
      bespoke: {
        tags: ["Individualūs baldai", "Išskirtinė apdaila", "Medžiagų parinkimas"],
        title: "Individualūs interjero sprendimai",
        text: "Individualaus dizaino baldų projektavimas ir gamyba, pagal užsakymą gaminamos durys, grindų dizainas ir gamyba bei akmens apdailos sprendimai.",
      },
      installation: {
        tags: ["Transportavimas", "Montavimas", "Nuolatinė priežiūra"],
        title: "Įrengimas ir aptarnavimas po pardavimo",
        text: "Visapusiškas diegimas vietoje, įskaitant įrengimą, konfigūravimą, testavimą ir galutinį paleidimą, taip pat techninę pagalbą ir aptarnavimą po projekto perdavimo.",
      },
    },
  },
  // Figma "Services page" (node 4217:49704); the CTA title keeps the client's correction
  servicesPage: {
    meta: { title: "Paslaugos — Simetria LT", description: "Profesionalūs interjero sprendimai: apšvietimo dizainas, išmaniųjų namų sistemos, individualūs interjerai, įrengimas." },
    hero: {
      title: ["Profesionalūs", "interjero sprendimai"],
      text: "Mažiname atotrūkį tarp dizaino vizijos ir techninių galimybių, pasitelkdami ekspertų pagalbą, parengdami tikslias specifikacijas ir užtikrindami atsakomybę visame projekte.",
      button: "Užsisakykite konsultaciją",
    },
    process: [
      {
        title: "Konsultacijos ir projekto analizė",
        text: "Išnagrinėdami jūsų tikslus, erdvę ir viziją, rekomenduojame jums idealiai tinkamus baldus iš mūsų kruopščiai atrinktų pasiūlymų.",
      },
      {
        title: "Atranka ir pasiūlymas",
        text: "Mūsų komanda atrenka baldus ir šviestuvus iš atstovaujamų prekių ženklų, paruošia pavyzdžius ir pasiūlymą su kainomis bei pristatymo terminais.",
      },
      {
        title: "Užsakymai ir koordinavimas",
        text: "Pateikiame ir sekame kiekvieną užsakymą, deriname pristatymus su statybų grafiku ir išliekame vienu kontaktiniu asmeniu visam projektui.",
      },
      {
        title: "Pristatymas ir projekto užbaigimas",
        text: "Montavimas, paleidimas ir galutinė apžiūra, o po to – aptarnavimas po pardavimo tol, kol erdvė naudojama.",
      },
    ],
    cta: {
      eyebrow: "Susipažinkite su mūsų projektais",
      title: "Meistriškų idėjų, integruotų sprendimų ir intelektualaus dizaino namai.",
      text: "Skaičiavimai, atitiktis reikalavimams, pažangi integracija ir individualiai pritaikyti įrenginiai.",
      button: "Slinkti",
    },
  },
  servicePage: {
    home: "Pagrindinis puslapis",
    services: "Paslaugos",
    book: "Užsisakykite konsultaciją",
    howWeWork: "KAIP MES DIRBAME",
    stagesHeading: "Nuo užduoties aprašymo iki įrengimo etapais",
    viewProject: "Peržiūrėti projektą",
  },
  // Figma "Services page: lighting" (node 4217:48103); overview keeps the client's corrections
  servicePages: {
    lighting: {
      title: "Apšvietimo projektavimas ir sprendimai",
      titleLines: ["Apšvietimo projektavimas", "ir sprendimai"],
      breadcrumb: "Apšvietimo projektavimas ir sprendimai",
      intro: "Mes specializuojamės apšvietimo projektavime, skaičiavimuose ir individualiai pritaikytų šviestuvų gamyboje. Nuo idėjos iki projekto perdavimo – mes rūpinamės kiekviena smulkmena, kad įgyvendintume jūsų viziją.",
      stages: [
        { label: "Užsisakykite konsultaciją", text: "Prieš nurodydami bent vieną liukso vertę, įvertiname erdvę – lubų aukštį, dienos šviesą, medžiagas, paskirtį" },
        { label: "Koncepcija ir projektinis planas", text: "Nuotaikos studijos, apšvietimo sluoksnių strategija ir pirmosios šviestuvų šeimos, suderintos su architektu prieš detalizavimą" },
        { label: "Techninė specifikacija", text: "Fotometriniai skaičiavimai, šviestuvų sąrašas, valdymo zonos ir atitikties patikros" },
        { label: "Pirkimai ir tiekimas", text: "Užsakymai atstovaujamiems gamintojams, pristatymo terminai suderinti su statybų grafiku" },
        { label: "Įrengimas ir priėmimas", text: "Priežiūra objekte, nukreipimas ir paleidimas, o po to – galutinė apžiūra su klientu" },
      ],
      recentWork: {
        eyebrow: "NAUJAUSI APŠVIETIMO DARBAI",
        heading: "Įgyvendinti apšvietimo projektai",
        cards: [
          { category: "BŪSTAI · INDIVIDUALIAI PRITAIKYTI ĮRENGINIAI", title: "„Baltic Innovation“ būstinė", tag: "NAUJAS PROJEKTAS" },
          { category: "BŪSTAI · INDIVIDUALIAI PRITAIKYTI ĮRENGINIAI", title: "„Baltic Residence“", tag: "NAUJAS PROJEKTAS" },
        ],
      },
      overview: {
        heading: "Apšvietimo projektų rengimas",
        text: "Mes rengiame apšvietimo projektus nuo koncepcijos iki parengtų techninių specifikacijų – bendradarbiaudami su architektų komanda, siekiame erdvės viziją paversti techniškai pagrįstu ir biudžetą atitinkančiu apšvietimo projektu.",
        points: [
          "Koncepcija ir atmosfera",
          "Šviestuvų parinktys ir techniniai parametrai",
          "Fotometriniai skaičiavimai",
          "Dokumentacija ir sąmatos",
        ],
      },
    },
  },
  letsTalk: ["Pakalbėkime"],
  footer: {
    title: "Jūsų visapusiškas partneris kuriant erdves",
    text: "Mes parenkame, suderiname, pristatome ir koordinuojame kiekvieną jūsų interjero įrengimo projekto etapą.",
    cta: "Susisiekite su mumis",
    columns: { products: "Produktai", services: "Paslaugos", company: "Įmonė", social: "Socialiniai tinklai" },
    products: { furniture: "Baldai", lighting: "Apšvietimas", decor: "Interjero detalės (aksesuarai)", outlet: "Išparduotuvė" },
    services: {
      lighting: "Apšvietimo projektavimas ir sprendimai",
      smartHome: "Išmaniųjų namų sistemos",
      bespoke: "Individualūs interjero sprendimai",
      installation: "Įrengimas ir garantinis aptarnavimas",
    },
    company: { projects: "Projektai", brands: "Gamintojai", about: "Apie", contacts: "Kontaktai" },
    contactUs: "Susisiekite su mumis",
    call: "Paskambinkite mums",
    email: "Parašykite mums el. laišką",
    showroom: "„Simetria“ salonas",
    showroomValue: "Vilnius, Lietuva",
    copyright: (year) => `© Autorių teisės ${year} Simetria`,
    privacy: "Privatumo politika",
    cookie: "Slapukas",
  },
};
