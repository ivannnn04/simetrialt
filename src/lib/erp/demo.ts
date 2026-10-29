import { db } from "@/lib/db";
import { ACTIVITY_TYPES, CHANNELS } from "./config";
import { addPayment, createDocument, ensureWarehouses, offerToOrder, orderToInvoice, orderToPrepayment, orderToPurchaseOrders, receivePurchaseOrder, type LineInput } from "./docs";
import { docTotals } from "./money";

/**
 * Demonstration data for presenting the ERP: fictional clients, architects and partners, real
 * suppliers (catalogue brands) and real catalogue products, run through the actual order flow
 * (offer → order → prepayment → purchase orders → receipt → invoice → payments → commission)
 * over the past 18 months. Everything is flagged isDemo and can be removed in one click.
 */

let seed = 20261029;
const rnd = () => {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
};
const pick = <T,>(xs: T[]) => xs[Math.floor(rnd() * xs.length)];
const int = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
const daysAgo = (n: number) => new Date(Date.now() - n * 864e5);

const FIRST = ["Jonas", "Ona", "Tomas", "Eglė", "Mantas", "Rūta", "Paulius", "Gintarė", "Darius", "Indrė", "Lukas", "Agnė", "Marius", "Justė", "Andrius", "Simona", "Karolis", "Viktorija", "Rokas", "Laura"];
const LAST_M = ["Kazlauskas", "Jankauskas", "Petrauskas", "Stankevičius", "Vasiliauskas", "Žukauskas", "Butkus", "Paulauskas", "Urbonas", "Kavaliauskas"];
const LAST_F = ["Kazlauskienė", "Jankauskaitė", "Petrauskienė", "Stankevičiūtė", "Vasiliauskienė", "Žukauskaitė", "Butkienė", "Paulauskaitė", "Urbonienė", "Kavaliauskienė"];
const FEMALE = new Set(["Ona", "Eglė", "Rūta", "Gintarė", "Indrė", "Agnė", "Justė", "Simona", "Viktorija", "Laura"]);
const COMPANIES = ["UAB „Baltic Hotels Group“", "UAB „Senamiesčio apartamentai“", "UAB „Nordic Office Parks“", "UAB „Vilniaus restoranai“", "UAB „Pajūrio vilos“", "UAB „Green Living“", "UAB „Domus Interior“", "UAB „Urban Lofts“"];
const ARCH = [
  ["Studija „Linija“", "A grupės architektų ofisas", 10],
  ["„Forma Architects“", "A grupės architektų ofisas", 8],
  ["Interjero dizaino studija „Erdvė“", "B grupės architektų ofisas", 7],
  ["„Aketuri“ architektai (demo)", "A grupės architektų ofisas", 10],
  ["Studija „Kampas“", "B grupės architektų ofisas", 5],
  ["„Light & Space“ dizainas", "B grupės architektų ofisas", 6],
] as const;
const PARTNERS = ["UAB „Baldų centras“ (partneris)", "UAB „Šviesos namai“ (partneris)"];
const CITIES = ["Vilnius", "Kaunas", "Klaipėda", "Palanga", "Šiauliai"];

export async function createDemoData(managerIds: string[]): Promise<string> {
  await ensureWarehouses();
  const warehouses = await db.erpWarehouse.findMany();
  const wh = (code: number) => warehouses.find((w) => w.code === code)!.id;
  const mgr = () => (managerIds.length ? pick(managerIds) : null);

  // products from the website catalogue (with a price) — purchase cost ≈ 55% of the net price
  const products = await db.product.findMany({ where: { priceCents: { gt: 0 } }, include: { images: { orderBy: { sort: "asc" }, take: 1 } }, take: 400, orderBy: { updatedAt: "desc" } });
  if (products.length < 3) return "Kataloge per mažai produktų su kaina demonstraciniams duomenims.";
  const touched = products.filter((p) => p.costCents == null).map((p) => p.id);
  if (touched.length) {
    // one statement instead of one update per product
    await db.$executeRaw`UPDATE "Product" SET "costCents" = ROUND("priceCents" / 1.21 * 0.55), "supplierName" = "brand" WHERE "id" = ANY(${touched}) AND "costCents" IS NULL`;
    for (const p of products) if (p.costCents == null) p.costCents = Math.round((p.priceCents / 1.21) * 0.55);
  }
  await db.setting.upsert({ where: { key: "erp.demo.products" }, update: { value: JSON.stringify(touched) }, create: { key: "erp.demo.products", value: JSON.stringify(touched) } });

  // suppliers = the catalogue's brands
  const brands = [...new Set(products.map((p) => p.brand).filter(Boolean))] as string[];
  const supplierByBrand = new Map<string, string>();
  for (const b of brands.length ? brands : ["Flos", "Catellani & Smith"]) {
    const s = await db.erpContact.create({ data: { name: b, category: "Tiekėjas", tags: ["Foreign supplier"], email: `orders@${b.toLowerCase().replace(/[^a-z]/g, "")}.com`, isDemo: true } });
    supplierByBrand.set(b, s.id);
  }
  await db.erpContact.create({ data: { name: "UAB „Greitas krovinys“", category: "Vežėjai", isDemo: true, phone: "+370 600 00000" } });

  const architects = [];
  for (const [name, tag, pctC] of ARCH) {
    const a = await db.erpContact.create({ data: { name, category: "Architektas", tags: [tag], commissionPct: pctC, email: `info@${name.toLowerCase().replace(/[^a-z]/g, "") || "studija"}.lt`, address: `${pick(CITIES)}, Lietuva`, isDemo: true, managerId: mgr() } });
    architects.push(a);
  }
  const partners = [];
  for (const name of PARTNERS) partners.push(await db.erpContact.create({ data: { name, category: "Partneris", isDemo: true, managerId: mgr() } }));

  const clients = [];
  for (const name of COMPANIES) {
    const c = await db.erpContact.create({ data: { name, kind: "COMPANY", category: "Klientas", regCode: String(int(300000000, 306999999)), vatCode: `LT${int(100000000, 999999999)}`, address: `${pick(CITIES)}, Lietuva`, email: "info@example.lt", isDemo: true, managerId: mgr(), tags: rnd() < 0.3 ? ["Projektinis klientas"] : [] } });
    clients.push(c);
    const f = pick(FIRST);
    await db.erpContact.create({ data: { name: `${f} ${FEMALE.has(f) ? pick(LAST_F) : pick(LAST_M)}`, kind: "PERSON", category: "Klientas", companyId: c.id, position: pick(["Direktorius", "Projektų vadovas", "Pirkimų vadovė"]), email: "kontaktas@example.lt", isDemo: true } });
  }
  for (let i = 0; i < 22; i++) {
    const f = FIRST[i % FIRST.length];
    clients.push(await db.erpContact.create({ data: { name: `${f} ${FEMALE.has(f) ? pick(LAST_F) : pick(LAST_M)}`, kind: "PERSON", category: "Klientas", phone: `+370 6${int(10, 99)} ${int(10000, 99999)}`, email: `${f.toLowerCase().normalize("NFD").replace(/[^a-z]/g, "")}${i}@example.lt`, address: `${pick(CITIES)}, Lietuva`, isDemo: true, managerId: mgr(), tags: rnd() < 0.15 ? ["VIP"] : [] } }));
  }

  const lineFor = (p: (typeof products)[number]): LineInput => {
    const net = Math.round(p.priceCents / 1.21);
    return {
      productId: p.id,
      code: p.sku ?? "",
      name: p.name,
      qty: pick([1, 1, 1, 2, 2, 4, 6]),
      priceCents: net,
      discountPct: pick([0, 0, 5, 10, 15]),
      vatPct: 21,
      supplierId: (p.brand && supplierByBrand.get(p.brand)) || null,
      costCents: p.costCents ?? Math.round(net * 0.55),
      image: p.images[0]?.url ?? "",
    };
  };

  let offers = 0;
  let orders = 0;
  for (let i = 0; i < 70; i++) {
    const age = int(2, 540);
    const at = daysAgo(age);
    const channel = rnd() < 0.55 ? CHANNELS[0] : rnd() < 0.7 ? CHANNELS[1] : CHANNELS[2];
    const party = channel === CHANNELS[0] ? pick(architects) : channel === CHANNELS[2] ? pick(partners) : null;
    const items = Array.from({ length: int(1, 5) }, () => lineFor(pick(products)));
    // the funnel: older offers are mostly decided
    const status = age > 60 ? pick(["Užsakytas", "Užsakytas", "Užsakytas", "Atmestas", "Pasirinko konkurentą", "Nebegalioja", "Analogas"]) : pick(["Domisi", "Derinamas", "Derinamas", "Derinamas", "Užsakytas", "Protekcija"]);
    const offer = await createDocument(
      "OFFER",
      { date: at, validUntil: new Date(at.getTime() + 30 * 864e5), clientId: pick(clients).id, partyId: party?.id ?? null, channel, managerId: mgr(), isDemo: true, status: status === "Užsakytas" ? "Derinamas" : status, note: rnd() < 0.3 ? "Kliento pageidavimas – pristatymas su montavimu." : "" },
      items,
      "Demo"
    );
    offers++;
    if (status !== "Užsakytas") continue;

    // order and everything after it, spread over the weeks after the offer
    const step = (d: number) => new Date(at.getTime() + d * 864e5);
    const order = await offerToOrder(offer.id, "Demo", step(int(3, 10)));
    orders++;
    const done = (d: number) => step(d).getTime() < Date.now();
    if (!done(12)) continue;
    await db.erpDocument.update({ where: { id: order.id }, data: { status: "Patvirtintas / galima užs." } });
    const pre = await orderToPrepayment(order.id, "Demo", step(12));
    const preTotal = docTotals((await db.erpLine.findMany({ where: { documentId: pre.id } })), 0).total;
    if (done(15)) await addPayment(pre.id, preTotal, rnd() < 0.85 ? "Pavedimas" : "Grynieji (KPO)", step(15), "", "Demo");
    if (!done(18)) continue;
    const pos = await orderToPurchaseOrders(order.id, "Demo", step(18));
    if (!done(60)) {
      for (const po of pos) await db.erpDocument.update({ where: { id: po.id }, data: { status: pick(["Užsakymas patvirtintas", "Artėja gamybos terminas", "Organizuojamas transport."]) } });
      await db.erpDocument.update({ where: { id: order.id }, data: { status: pick(["Pirkimas/gamyba", "Kelyje"]) } });
      continue;
    }
    const target = wh(pick([2, 2, 10, 3]));
    for (const po of pos) {
      const lines = await db.erpLine.findMany({ where: { documentId: po.id } });
      await receivePurchaseOrder(po.id, target, Object.fromEntries(lines.map((l) => [l.id, l.qty])), "Demo");
      await db.erpActivity.create({ data: { title: `Krovinio atvykimas – ${po.number}`, type: "Krovinio atvykimas", start: step(60), allDay: true, documentId: po.id, isDemo: true, done: true } });
    }
    if (!done(70)) continue;
    const inv = await orderToInvoice(order.id, "Demo", step(70));
    const invTotal = docTotals(await db.erpLine.findMany({ where: { documentId: inv.id } }), 0).total;
    if (done(80) && rnd() < 0.85) {
      await addPayment(inv.id, invTotal, "Pavedimas", step(80), "", "Demo");
      await db.erpDocument.update({ where: { id: order.id }, data: { status: "Užbaigtas / atiduotas" } });
      await db.erpDocument.update({ where: { id: offer.id }, data: { status: "Visiškai įgyvendintas" } });
      // older commissions are already paid out
      const c = await db.erpCommission.findFirst({ where: { documentId: inv.id } });
      if (c && done(120) && rnd() < 0.7) {
        await db.erpCommission.update({ where: { id: c.id }, data: { status: "PAID", paidAt: step(110), method: "Pavedimas" } });
        await db.erpDocument.update({ where: { id: order.id }, data: { status: "Atsiskaityta architektui" } });
      } else if (c && rnd() < 0.5) await db.erpCommission.update({ where: { id: c.id }, data: { status: "APPROVED" } });
    }
  }
  // show-room stock that is not tied to orders
  for (const p of products.slice(0, 25)) {
    const q = int(1, 3);
    await db.erpStock.upsert({
      where: { productId_warehouseId: { productId: p.id, warehouseId: wh(11) } },
      update: { qty: { increment: q } },
      create: { productId: p.id, warehouseId: wh(11), qty: q, costCents: p.costCents ?? Math.round((p.priceCents / 1.21) * 0.55) },
    });
    await db.erpStockMove.create({ data: { productId: p.id, warehouseId: wh(11), type: "RECEIPT", qty: q, costCents: p.costCents ?? 0, note: "Ekspozicija (demo)" } });
  }
  // calendar around today
  const salesTypes = ACTIVITY_TYPES["Pardavimų vadybininkas"];
  const contactsForActs = [...clients, ...architects];
  for (let i = 0; i < 90; i++) {
    const d = new Date(Date.now() + int(-25, 25) * 864e5);
    d.setHours(int(9, 17), pick([0, 30]), 0, 0);
    const type = rnd() < 0.8 ? pick(salesTypes) : pick([...ACTIVITY_TYPES["Gamintojai | Tiekimas | Distribucijos"], ...ACTIVITY_TYPES["Bendros veiklos"]]);
    const contact = pick(contactsForActs);
    await db.erpActivity.create({
      data: { title: `${type.replace(/^\d+(\.\d+)?\.\s*/, "")} – ${contact.name}`, type, start: d, end: new Date(d.getTime() + pick([30, 60, 90]) * 60e3), contactId: contact.id, userIds: managerIds.length ? [pick(managerIds)] : [], done: d.getTime() < Date.now() && rnd() < 0.8, isDemo: true },
    });
  }
  return `Sukurta: ${offers} pasiūlymų, ${orders} užsakymų su visa grandine, ${clients.length} klientų, ${architects.length} architektų, ${supplierByBrand.size} tiekėjų.`;
}

/** Recomputes stock levels from the remaining movements (after demo data is removed). */
async function rebuildStock() {
  const moves = await db.erpStockMove.findMany();
  const map = new Map<string, { productId: string; warehouseId: string; qty: number; cost: number }>();
  const add = (productId: string, warehouseId: string, q: number, cost: number) => {
    const k = `${productId}|${warehouseId}`;
    const e = map.get(k) ?? { productId, warehouseId, qty: 0, cost };
    e.qty += q;
    if (q > 0) e.cost = cost;
    map.set(k, e);
  };
  for (const m of moves) {
    if (m.type === "RECEIPT") add(m.productId, m.warehouseId, m.qty, m.costCents);
    else if (m.type === "TRANSFER") {
      add(m.productId, m.warehouseId, -m.qty, m.costCents);
      if (m.toWarehouseId) add(m.productId, m.toWarehouseId, m.qty, m.costCents);
    } else if (m.type === "ISSUE" || m.type === "WRITEOFF") add(m.productId, m.warehouseId, -m.qty, m.costCents);
  }
  // reservations of real orders survive (bounded by what is left on the shelf)
  const reservedBefore = new Map((await db.erpStock.findMany()).map((s) => [`${s.productId}|${s.warehouseId}`, s.reserved]));
  await db.erpStock.deleteMany();
  for (const [k, e] of map) {
    if (e.qty > 0) await db.erpStock.create({ data: { productId: e.productId, warehouseId: e.warehouseId, qty: e.qty, costCents: e.cost, reserved: Math.min(e.qty, reservedBefore.get(k) ?? 0) } });
  }
}

export async function deleteDemoData(): Promise<string> {
  const docs = await db.erpDocument.findMany({ where: { isDemo: true }, select: { id: true } });
  const ids = docs.map((d) => d.id);
  await db.erpStockMove.deleteMany({ where: { OR: [{ documentId: { in: ids } }, { note: "Ekspozicija (demo)" }] } });
  await db.erpActivity.deleteMany({ where: { OR: [{ isDemo: true }, { documentId: { in: ids } }] } });
  await db.erpDocument.deleteMany({ where: { isDemo: true } });
  await db.erpContact.deleteMany({ where: { isDemo: true } });
  await rebuildStock();
  const row = await db.setting.findUnique({ where: { key: "erp.demo.products" } });
  const touched = row ? (JSON.parse(row.value) as string[]) : [];
  if (touched.length) await db.product.updateMany({ where: { id: { in: touched } }, data: { costCents: null, supplierName: null } });
  await db.setting.deleteMany({ where: { key: "erp.demo.products" } });
  // numbering starts over when no real documents exist
  if ((await db.erpDocument.count()) === 0) await db.erpCounter.deleteMany();
  return `Ištrinta demonstracinių dokumentų: ${ids.length}.`;
}
