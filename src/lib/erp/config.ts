/** ERP configuration taken from the Scoro audit (build spec §3–§4): document types, statuses, lists. */

export type DocType = "OFFER" | "ORDER" | "PURCHASE_ORDER" | "INVOICE" | "PREPAYMENT" | "CREDIT" | "PURCHASE_INVOICE";

export type StatusDef = { key: string; color: string; probability?: number; active?: boolean; success?: boolean; side?: boolean };

const C = {
  grey: "bg-zinc-100 text-zinc-700",
  blue: "bg-blue-100 text-blue-800",
  sky: "bg-sky-100 text-sky-800",
  indigo: "bg-indigo-100 text-indigo-800",
  violet: "bg-violet-100 text-violet-800",
  amber: "bg-amber-100 text-amber-800",
  orange: "bg-orange-100 text-orange-800",
  green: "bg-green-100 text-green-800",
  emerald: "bg-emerald-100 text-emerald-800",
  red: "bg-red-100 text-red-800",
  rose: "bg-rose-100 text-rose-800",
};

export const STATUSES: Record<DocType, StatusDef[]> = {
  OFFER: [
    { key: "Domisi", color: C.sky, probability: 5, active: true },
    { key: "Derinamas", color: C.blue, probability: 50, active: true },
    { key: "Užsakytas", color: C.green, probability: 100, success: true },
    { key: "Visiškai įgyvendintas", color: C.emerald, probability: 100, success: true },
    { key: "Atmestas", color: C.red, probability: 0 },
    { key: "Pasirinko konkurentą", color: C.rose, probability: 0 },
    { key: "Analogas", color: C.grey, probability: 0 },
    { key: "Protekcija", color: C.violet, probability: 50, active: true },
    { key: "Nebegalioja", color: C.grey, probability: 0 },
  ],
  ORDER: [
    { key: "Laukia patvirtinimo", color: C.amber, active: true },
    { key: "Patvirtintas / galima užs.", color: C.blue, active: true },
    { key: "Pirkimas/gamyba", color: C.indigo, active: true },
    { key: "Kelyje", color: C.violet, active: true },
    { key: "Kelyje užs. dalis", color: C.violet, active: true },
    { key: "Prekės sandėlyje", color: C.sky, active: true },
    { key: "Paruoštas atsiimti", color: C.orange, active: true },
    { key: "Išrašyta sąskaita", color: C.amber, active: true },
    { key: "Užbaigtas / atiduotas", color: C.green, success: true },
    { key: "Atsiskaityta architektui", color: C.emerald, success: true },
    { key: "Negalioja / Atmestas", color: C.red, side: true },
    { key: "Sąskaita yra, sandėliuoja", color: C.grey, side: true, active: true },
  ],
  PURCHASE_ORDER: [
    { key: "Išsiųstas gamintojui", color: C.blue, active: true },
    { key: "Užsakymas patvirtintas", color: C.indigo, active: true },
    { key: "Artėja gamybos terminas", color: C.amber, active: true },
    { key: "Organizuojamas transport.", color: C.violet, active: true },
    { key: "Dalinai gautas", color: C.sky, active: true },
    { key: "Gautas", color: C.green },
    { key: "Išsiųstas apmokėti", color: C.emerald },
    { key: "Kaupiame – on hold", color: C.grey, side: true, active: true },
    { key: "Užsakymas vėluoja", color: C.orange, side: true, active: true },
    { key: "Atšauktas", color: C.red, side: true },
    { key: "CLAIM", color: C.rose, side: true, active: true },
    { key: "CLAIM - SOLVED", color: C.green, side: true },
    { key: "CLAIM uždarytas", color: C.grey, side: true },
  ],
  INVOICE: [
    { key: "Neapmokėta", color: C.amber, active: true },
    { key: "Dalinai apmokėta", color: C.orange, active: true },
    { key: "Apmokėta", color: C.green, success: true },
    { key: "Vėluoja", color: C.red, active: true },
    { key: "Anuliuota", color: C.grey, side: true },
  ],
  PREPAYMENT: [
    { key: "Neapmokėta", color: C.amber, active: true },
    { key: "Dalinai apmokėta", color: C.orange, active: true },
    { key: "Apmokėta", color: C.green, success: true },
    { key: "Vėluoja", color: C.red, active: true },
    { key: "Anuliuota", color: C.grey, side: true },
  ],
  CREDIT: [
    { key: "Išrašyta", color: C.blue },
    { key: "Grąžinta", color: C.green },
  ],
  PURCHASE_INVOICE: [
    { key: "Neapmokėta", color: C.amber, active: true },
    { key: "Apmokėta", color: C.green },
    { key: "Vėluoja", color: C.red, active: true },
  ],
};

export const DOC: Record<DocType, { label: string; plural: string; path: string; series: string; withCost: boolean; counterparty: "client" | "supplier" }> = {
  OFFER: { label: "Pasiūlymas", plural: "Pasiūlymai", path: "offers", series: "P", withCost: true, counterparty: "client" },
  ORDER: { label: "Užsakymas", plural: "Užsakymai", path: "orders", series: "SDO", withCost: true, counterparty: "client" },
  PURCHASE_ORDER: { label: "Pirkimo užsakymas", plural: "Pirkimo užsakymai", path: "purchase-orders", series: "PU", withCost: false, counterparty: "supplier" },
  INVOICE: { label: "Sąskaita faktūra", plural: "Sąskaitos", path: "invoices", series: "SF", withCost: true, counterparty: "client" },
  PREPAYMENT: { label: "Išankstinė sąskaita", plural: "Išankstinės sąskaitos", path: "invoices", series: "IS", withCost: false, counterparty: "client" },
  CREDIT: { label: "Kreditinė sąskaita", plural: "Kreditinės sąskaitos", path: "invoices", series: "KS", withCost: false, counterparty: "client" },
  PURCHASE_INVOICE: { label: "Pirkimo sąskaita", plural: "Pirkimo sąskaitos", path: "purchase-invoices", series: "PS", withCost: false, counterparty: "supplier" },
};

export const PATH_TYPES: Record<string, DocType[]> = {
  offers: ["OFFER"],
  orders: ["ORDER"],
  "purchase-orders": ["PURCHASE_ORDER"],
  invoices: ["INVOICE", "PREPAYMENT", "CREDIT"],
  "purchase-invoices": ["PURCHASE_INVOICE"],
};

export const statusDef = (type: string, key: string): StatusDef =>
  STATUSES[type as DocType]?.find((s) => s.key === key) ?? { key, color: "bg-zinc-100 text-zinc-700" };

export const defaultStatus = (type: DocType) =>
  ({ OFFER: "Derinamas", ORDER: "Laukia patvirtinimo", PURCHASE_ORDER: "Išsiųstas gamintojui", INVOICE: "Neapmokėta", PREPAYMENT: "Neapmokėta", CREDIT: "Išrašyta", PURCHASE_INVOICE: "Neapmokėta" })[type];

export const CONTACT_CATEGORIES = ["Klientas", "Architektas", "Partneris", "Tiekėjas", "Vežėjai", "Agentas", "Elektrikas", "Apšvietos skaičiavimas", "IT", "Marketingas"];

export const CONTACT_TAGS = ["A grupės architektų ofisas", "B grupės architektų ofisas", "Foreign supplier", "Local supplier", "VIP", "Projektinis klientas"];

export const CHANNELS = ["Pardavimas architektams", "Be architekto", "Pardavimas partneriams"];

export const DELIVERY_TERMS = ["2–4 savaitės", "4–6 savaitės", "6–8 savaitės", "8–12 savaičių", "12–16 savaičių", "Iš sandėlio"];

export const WAREHOUSES: [number, string][] = [
  [11, "Ekspozicija"],
  [12, "Rampa"],
  [10, "BULAUTRA SANDĖLYS"],
  [2, "KLIENTŲ PREKĖS + REZERVAS"],
  [8, "Pasiūlymams"],
  [3, "EKSPOZICIJA + RAMPA SANDĖLYS"],
  [1, "Gevara sandėlys"],
  [9, "7-ta rampa Domus Galerija"],
  [4, "Nurašymui"],
];

export const ACTIVITY_TYPES: Record<string, string[]> = {
  "Bendros veiklos": ["Atostogos", "Darbas iš namų", "Darbų planavimas", "Komandiruotė", "Laisva diena", "Vidiniai mokymai"],
  Buhalterija: ["Skolos", "Teismai | ieškiniai | antstoliai"],
  "Gamintojai | Tiekimas | Distribucijos": [
    "Didmeninių partnerių vizitavimas/konsultavimas",
    "Gamintojų peržiūra",
    "Gamintojų/agentų skambučiai",
    "Gamintojų/agentų vizitai",
    "Krovinio atvykimas",
    "Parodos",
    "Potencialių gamintojų analizė",
    "Priminimas",
    "Vizitai į gamyklas",
  ],
  "Pardavimų vadybininkas": [
    "1. Skambutis – architektui",
    "1. Skambutis – klientui",
    "2. Susitikimas – su architektu",
    "2. Susitikimas – su klientu",
    "4. Pasiūlymas – išsiuntimas",
    "5. Skambutis – po pasiūlymo išsiuntimo",
    "7. Užsakymo sutarties – ruošimas ir siuntimas",
    "8. Užsakymas – išsiuntimas logistikai",
    "9. Užsakymas – atidavimas klientui",
    "9.1. Sąskaita – siuntimas klientui",
    "10. Darbas ekspozicijoje",
    "11. Konsultavimas salone",
    "12. Pretenzija / Brokas registravimas",
    "13. Garantinis aptarnavimas",
    "14. Pasiūlymo koregavimas",
    "18. Vizitas pas architektus",
    "Vizitas pas užsakovą",
  ],
};

export const ACTIVITY_GROUP_COLOR: Record<string, string> = {
  "Bendros veiklos": "bg-zinc-200 text-zinc-800",
  Buhalterija: "bg-red-100 text-red-800",
  "Gamintojai | Tiekimas | Distribucijos": "bg-violet-100 text-violet-800",
  "Pardavimų vadybininkas": "bg-blue-100 text-blue-800",
};

export const activityGroup = (type: string) => Object.entries(ACTIVITY_TYPES).find(([, ts]) => ts.includes(type))?.[0] ?? "Bendros veiklos";

export const PAYMENT_METHODS = ["Pavedimas", "Grynieji (KPO)", "Kortelė"];

/** Default commission when an architect has none set (to be confirmed with the client, spec §13). */
export const DEFAULT_COMMISSION_PCT = 10;

export const COMPANY = {
  name: 'UAB "Identia"',
  brand: "Simetria",
  regCode: "302xxxxxx",
  vatCode: "LT100xxxxxxx",
  address: "Vilnius, Lietuva",
  bank: "AB SEB bankas, LT00 7044 0000 0000 0000",
};
