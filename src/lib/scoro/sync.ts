import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { VAT_PCT, quoteNumber } from "@/lib/quotes";
import { isConfigured, saveScoroConfig, scoroCall, scoroConfig, scoroLog, ScoroError, type ScoroConfig } from "./client";

/**
 * Two-way sync between the website and Scoro.
 *
 * Website → Scoro
 *  - products: matched by code (= website SKU, or slug when there is none). A product the website created
 *    gets name, description, net price, link and photos; a product that already existed in Scoro only gets
 *    the website link and photo links unless "overwriteExisting" is on.
 *  - inquiries from the website: a contact (found by e-mail or created) and a quote with the product asked about.
 *  - offers prepared in the admin: a Scoro quote, created once and updated afterwards.
 * Scoro → website
 *  - quote webhooks: Scoro quotes appear in the admin offers list (pullQuotes) and their lines get the
 *    website photos in the photo field when it is empty (enrichQuotes).
 *  - prices: Scoro prices changed since the last pull update the website prices (pullPrices).
 *
 * Scoro prices are net, the website shows prices with VAT.
 */

export const PHOTO_FIELD = "c_nuotrauka3";

export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return (explicit || (vercel ? `https://${vercel}` : "https://simetrialt.vercel.app")).replace(/\/+$/, "");
}

const toNet = (cents: number) => (cents / 100 / (1 + VAT_PCT / 100)).toFixed(4);
const toGross = (price: string | number | null | undefined) => Math.round(Number(price ?? 0) * (1 + VAT_PCT / 100) * 100);
const sha = (s: string) => createHash("sha1").update(s).digest("hex").slice(0, 20);
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const today = () => new Date().toISOString().slice(0, 10);
const stripHtml = (s: string) => s.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").trim();

/** The HTML Scoro's quote line photo field holds: one <img> per photo. */
export const photoHtml = (urls: string[]) => (urls.length ? `<p>${urls.map((u) => `<img src="${esc(u)}" width="300" alt="" />`).join("")}</p>` : "");

type ProductWithImages = Prisma.ProductGetPayload<{ include: { images: true } }>;

export type ScoroProductRow = {
  product_id: number;
  code: string | null;
  name: string;
  price: string | null;
  is_active: number;
  is_deleted?: number;
  modified_date: string;
};

/** Scoro may hold the same code several times: the active, most recently changed one wins. */
export async function findScoroProduct(c: ScoroConfig, code: string): Promise<ScoroProductRow | null> {
  if (!code.trim()) return null;
  const rows = (await scoroCall<ScoroProductRow[]>(c, "products/list", {}, { filter: { code }, per_page: 50 })) ?? [];
  const exact = rows.filter((r) => (r.code ?? "").trim().toLowerCase() === code.trim().toLowerCase() && !r.is_deleted);
  exact.sort((a, b) => b.is_active - a.is_active || String(b.modified_date).localeCompare(String(a.modified_date)));
  return exact[0] ?? null;
}

const productCode = (p: { sku: string | null; slug: string }) => (p.sku || p.slug).slice(0, 100);
const productLink = (p: { slug: string }) => `${siteUrl()}/catalogue/${p.slug}`;
const imageUrls = (p: ProductWithImages) => [...p.images].sort((a, b) => a.sort - b.sort).map((i) => i.url);

function productDescription(p: ProductWithImages): string {
  const facts = [p.brand && `Gamintojas: ${p.brand}`, p.typology && `Tipas: ${p.typology}`, p.material && `Medžiaga: ${p.material}`].filter(Boolean);
  const text = p.description.replace(/\*\*/g, "").replace(/^#+\s*/gm, "").trim();
  return [...facts, text, `Svetainėje: ${productLink(p)}`].filter(Boolean).join("\n\n").slice(0, 6000);
}

async function markProduct(id: string, scoroId: number, hash: string) {
  // raw SQL so that updatedAt (which marks the product as changed) is left alone
  await db.$executeRaw`UPDATE "Product" SET "scoroId" = ${scoroId}, "scoroSyncedAt" = NOW(), "scoroHash" = ${hash} WHERE "id" = ${id}`;
}

/** Creates or updates one product in Scoro. Returns the Scoro product id. */
export async function syncProduct(c: ScoroConfig, p: ProductWithImages): Promise<{ id: number; action: "created" | "updated" | "linked" | "unchanged" }> {
  const lang = c.lang || "eng";
  const code = productCode(p);
  const photos = imageUrls(p);
  const full: Record<string, unknown> = {
    code,
    names: { [lang]: p.name },
    description: { [lang]: productDescription(p) },
    description2: { [lang]: photos.join("\n") },
    price: toNet(p.priceCents),
    url: productLink(p),
    is_active: p.published ? 1 : 0,
    is_service: 0,
    ...(c.priceListId ? { price_list: Number(c.priceListId) } : {}),
  };
  const linkOnly = { url: productLink(p), description2: { [lang]: photos.join("\n") } };

  let own = p.scoroHash?.startsWith("own:") ?? false;
  let id = p.scoroId ?? null;
  if (!id) {
    const found = await findScoroProduct(c, code);
    if (found) {
      id = found.product_id;
      own = false;
    }
  }
  const payload = own || c.overwriteExisting || !id ? full : linkOnly;
  const hash = `${own || !id ? "own" : "ext"}:${sha(JSON.stringify(payload))}`;
  if (id && p.scoroId === id && p.scoroHash === hash) {
    // nothing Scoro holds would change: just record that this version was checked
    await markProduct(p.id, id, hash);
    return { id, action: "unchanged" };
  }

  if (id) {
    try {
      await scoroCall(c, `products/modify/${id}`, payload);
      await markProduct(p.id, id, hash);
      return { id, action: own || c.overwriteExisting ? "updated" : "linked" };
    } catch (e) {
      // deleted in Scoro meanwhile: create it again below
      if (!(e instanceof ScoroError) || !/not found|404|neegzist|nerast/i.test(e.message)) throw e;
    }
  }
  const created = await scoroCall<{ product_id?: number; id?: number }>(c, "products/modify", full);
  const newId = Number(created?.product_id ?? created?.id);
  if (!newId) throw new ScoroError(`Scoro nesugrąžino produkto ID (${code})`);
  await markProduct(p.id, newId, `own:${sha(JSON.stringify(full))}`);
  return { id: newId, action: "created" };
}

/** Products changed on the website since they were last sent (or never sent). */
export const pendingProductsWhere = (): Prisma.ProductWhereInput => ({
  OR: [{ scoroSyncedAt: null }, { updatedAt: { gt: db.product.fields.scoroSyncedAt } }],
});

/** Scoro product id for a website product, without writing to Scoro unless product sync is on. */
async function scoroProductId(c: ScoroConfig, p: ProductWithImages | null): Promise<number | null> {
  if (!p) return null;
  if (c.pushProducts) return (await syncProduct(c, p)).id;
  if (p.scoroId) return p.scoroId;
  return (await findScoroProduct(c, productCode(p)))?.product_id ?? null;
}

type ContactInput = { name: string; email?: string | null; phone?: string | null; company?: string | null };
type ScoroContact = { contact_id: number; means_of_contact?: { email?: string[] | string } | null };

/** Finds the client by e-mail or creates it (a company when a company name was given, else a person). */
export async function ensureContact(c: ScoroConfig, input: ContactInput): Promise<number> {
  const email = input.email?.trim().toLowerCase() || "";
  if (email) {
    const rows = (await scoroCall<ScoroContact[]>(c, "contacts/list", {}, { filter: { means_of_contact: { email } }, per_page: 10 })) ?? [];
    const match = rows.find((r) => {
      const e = r.means_of_contact?.email;
      return (Array.isArray(e) ? e : e ? [e] : []).some((x) => x.trim().toLowerCase() === email);
    });
    if (match) return match.contact_id;
  }
  const means = { ...(email ? { email } : {}), ...(input.phone?.trim() ? { phone: input.phone.trim() } : {}) };
  const [first, ...rest] = input.name.trim().split(/\s+/);
  const body = input.company?.trim()
    ? { contact_type: "company", name: input.company.trim(), means_of_contact: means, is_client: 1, comments: `Kontaktinis asmuo: ${input.name}` }
    : { contact_type: "person", name: first || input.name, lastname: rest.join(" "), means_of_contact: means, is_client: 1 };
  const created = await scoroCall<{ contact_id?: number; id?: number }>(c, "contacts/modify", body);
  const id = Number(created?.contact_id ?? created?.id);
  if (!id) throw new ScoroError("Scoro nesugrąžino kontakto ID");
  return id;
}

type LineOut = { product_id?: number; comment: string; price: string; amount: number; discount: number; custom_fields?: Record<string, string> };

/** Website inquiry → Scoro contact + quote ("Užklausa iš svetainės"). */
export async function pushLead(c: ScoroConfig, leadId: string): Promise<string> {
  const lead = await db.lead.findUnique({ where: { id: leadId } });
  if (!lead) return "užklausa ištrinta";
  if (lead.scoroQuoteId) return `jau Scoro (#${lead.scoroQuoteId})`;
  const contactId = lead.scoroContactId ?? (await ensureContact(c, lead));
  const product = lead.productSku ? await db.product.findUnique({ where: { sku: lead.productSku }, include: { images: true } }) : null;
  const lines: LineOut[] = [];
  if (product) {
    const pid = await scoroProductId(c, product);
    lines.push({
      ...(pid ? { product_id: pid } : {}),
      comment: `${product.name}${product.sku ? ` (${product.sku})` : ""}\n${productLink(product)}`,
      price: toNet(product.salePriceCents ?? product.priceCents),
      amount: 1,
      discount: 0,
      custom_fields: { [PHOTO_FIELD]: photoHtml(imageUrls(product).slice(0, 3)) },
    });
  }
  const description = [lead.message, [lead.email, lead.phone, lead.company].filter(Boolean).join(" · "), "Šaltinis: svetainės užklausa"].filter(Boolean).join("\n\n");
  const q = await scoroCall<{ id?: number }>(c, "quotes/modify", {
    company_id: contactId,
    quote_name: `Užklausa iš svetainės – ${lead.name}`.slice(0, 200),
    description,
    date: today(),
    currency: "EUR",
    lines,
  });
  const qid = Number(q?.id);
  await db.lead.update({ where: { id: lead.id }, data: { scoroContactId: contactId, scoroQuoteId: qid || null } });
  return `kontaktas #${contactId}, pasiūlymas #${qid || "?"}`;
}

type ScoroLine = Record<string, unknown> & {
  id?: number;
  product_id?: number;
  product_code?: string;
  product_name?: string;
  comment?: string;
  price?: string;
  amount?: string;
  discount?: string;
  custom_fields?: { id: string; value: unknown }[] | Record<string, unknown>;
};
export type ScoroQuote = {
  id: number;
  no?: string | number;
  status?: string;
  is_sent?: number;
  company_id?: number;
  company_name?: string;
  quote_name?: string;
  description?: string;
  discount?: string;
  deadline?: string;
  is_deleted?: number;
  lines?: ScoroLine[] | null;
};

/** Admin offer → Scoro quote (created once, then updated; lines are never removed in Scoro). */
export async function pushQuote(c: ScoroConfig, quoteId: string): Promise<string> {
  const quote = await db.quote.findUnique({ where: { id: quoteId }, include: { items: { orderBy: { sort: "asc" }, include: { product: { include: { images: true } } } } } });
  if (!quote) return "pasiūlymas ištrintas";
  if (!quote.customerName && !quote.company && !quote.customerEmail) return "praleista: nėra kliento";
  const contactId = await ensureContact(c, { name: quote.customerName || quote.company, email: quote.customerEmail, phone: quote.customerPhone, company: quote.company });
  const lines: LineOut[] = [];
  for (const it of quote.items) {
    const pid = await scoroProductId(c, it.product);
    const photos = it.product ? imageUrls(it.product).slice(0, 3) : it.image ? [it.image] : [];
    lines.push({
      ...(pid ? { product_id: pid } : {}),
      comment: `${it.name}${it.sku ? ` (${it.sku})` : ""}`,
      price: toNet(it.unitCents),
      amount: it.quantity,
      discount: it.discountPct,
      custom_fields: { [PHOTO_FIELD]: photoHtml(photos) },
    });
  }
  const header = {
    company_id: contactId,
    quote_name: `${quoteNumber(quote.number)} ${quote.customerName || quote.company}`.trim().slice(0, 200),
    description: quote.note,
    discount: quote.discountPct,
    currency: "EUR",
    ...(quote.validUntil ? { deadline: quote.validUntil.toISOString().slice(0, 10) } : {}),
    ...(quote.status === "DECLINED" ? { status: "declined" } : {}),
  };
  let note = "";
  if (quote.scoroId) {
    // keep Scoro's line ids so lines are updated in place; extra website lines are added
    const current = await scoroCall<ScoroQuote>(c, `quotes/view/${quote.scoroId}`);
    const existing = current?.lines ?? [];
    const merged = lines.map((l, i) => (existing[i]?.id ? { ...l, id: existing[i].id } : l));
    if (existing.length > lines.length) note = ` (Scoro liko ${existing.length - lines.length} papildomos eilutės – pašalinkite jas Scoro)`;
    await scoroCall(c, `quotes/modify/${quote.scoroId}`, { ...header, lines: merged });
    await db.$executeRaw`UPDATE "Quote" SET "scoroSyncedAt" = NOW() WHERE "id" = ${quote.id}`;
    return `atnaujintas Scoro pasiūlymas #${quote.scoroId}${note}`;
  }
  const created = await scoroCall<{ id?: number }>(c, "quotes/modify", { ...header, date: today(), lines });
  const sid = Number(created?.id);
  if (sid) await db.$executeRaw`UPDATE "Quote" SET "scoroId" = ${sid}, "scoroSyncedAt" = NOW() WHERE "id" = ${quote.id}`;
  return `sukurtas Scoro pasiūlymas #${sid || "?"}`;
}

const fieldValue = (cf: ScoroLine["custom_fields"], id: string): unknown =>
  Array.isArray(cf) ? cf.find((f) => f.id === id)?.value : cf && typeof cf === "object" ? (cf as Record<string, unknown>)[id] : undefined;

async function websiteProductFor(line: ScoroLine) {
  if (line.product_id) {
    const byId = await db.product.findUnique({ where: { scoroId: Number(line.product_id) }, include: { images: true } });
    if (byId) return byId;
  }
  const code = String(line.product_code ?? "").trim();
  return code ? db.product.findFirst({ where: { sku: { equals: code, mode: "insensitive" } }, include: { images: true } }) : null;
}

function mapStatus(q: ScoroQuote): string {
  if (q.status === "completed" || q.status === "approved") return "ACCEPTED";
  if (q.status === "declined") return "DECLINED";
  return q.is_sent ? "SENT" : "DRAFT";
}

/** Scoro quote (from a webhook) → admin offer. */
export async function applyScoroQuote(c: ScoroConfig, q: ScoroQuote): Promise<string> {
  const existing = await db.quote.findUnique({ where: { scoroId: q.id } });
  if (q.is_deleted) {
    if (!existing) return "ištrintas, nebuvo svetainėje";
    if (existing.source === "scoro") await db.quote.delete({ where: { id: existing.id } });
    else await db.$executeRaw`UPDATE "Quote" SET "scoroId" = NULL WHERE "id" = ${existing.id}`;
    return `ištrintas Scoro #${q.id}`;
  }
  // the echo of our own push: the website already holds this version
  if (existing?.scoroSyncedAt && Date.now() - existing.scoroSyncedAt.getTime() < 60_000) return "praleista (ką tik išsiųsta iš svetainės)";
  let email = "";
  let phone = "";
  if (q.company_id) {
    try {
      const ct = await scoroCall<{ means_of_contact?: { email?: string[] | string; phone?: string[] | string; mobile?: string[] | string } }>(c, `contacts/view/${q.company_id}`);
      const first = (v?: string[] | string) => (Array.isArray(v) ? v[0] : v) ?? "";
      email = first(ct?.means_of_contact?.email).toLowerCase();
      phone = first(ct?.means_of_contact?.mobile) || first(ct?.means_of_contact?.phone);
    } catch {
      // contact details are optional
    }
  }
  const items: Prisma.QuoteItemCreateWithoutQuoteInput[] = [];
  for (const [n, l] of (q.lines ?? []).entries()) {
    const product = await websiteProductFor(l);
    items.push({
      ...(product ? { product: { connect: { id: product.id } } } : {}),
      name: (String(l.product_name || "") || stripHtml(String(l.comment || "")).split("\n")[0] || "Pozicija").slice(0, 200),
      sku: String(l.product_code ?? product?.sku ?? "").slice(0, 80),
      image: product ? (imageUrls(product)[0] ?? "") : "",
      unitCents: toGross(l.price),
      quantity: Math.max(1, Math.round(Number(l.amount ?? 1))),
      discountPct: Number(l.discount ?? 0) || 0,
      sort: n,
    });
  }
  const deadline = q.deadline && /^\d{4}-\d{2}-\d{2}$/.test(q.deadline) && !q.deadline.startsWith("0000") ? new Date(q.deadline) : null;
  const data = {
    status: mapStatus(q),
    customerName: (q.company_name ?? "").slice(0, 200),
    customerEmail: email.slice(0, 200),
    customerPhone: phone.slice(0, 60),
    note: stripHtml(q.description ?? "").slice(0, 4000),
    discountPct: Number(q.discount ?? 0) || 0,
    validUntil: deadline,
    scoroSyncedAt: new Date(Date.now() - 120_000), // not an echo of a push
  };
  if (existing) {
    await db.$transaction([db.quoteItem.deleteMany({ where: { quoteId: existing.id } }), db.quote.update({ where: { id: existing.id }, data: { ...data, items: { create: items } } })]);
    return `atnaujintas pasiūlymas ${quoteNumber(existing.number)} iš Scoro #${q.id}`;
  }
  const created = await db.quote.create({ data: { ...data, source: "scoro", scoroId: q.id, items: { create: items } } });
  return `sukurtas pasiūlymas ${quoteNumber(created.number)} iš Scoro #${q.id}`;
}

/**
 * Fills the empty photo field of a Scoro quote's lines with the website photos of the same product.
 * All lines are sent back with their own values, so nothing but the photo field changes.
 */
export async function enrichScoroQuote(c: ScoroConfig, q: ScoroQuote): Promise<string> {
  const lines = q.lines ?? [];
  let filled = 0;
  const out: Record<string, unknown>[] = [];
  for (const l of lines) {
    const current = String(fieldValue(l.custom_fields, PHOTO_FIELD) ?? "").replace(/<p>\s*<\/p>/g, "").trim();
    const fields: Record<string, unknown> = {};
    if (Array.isArray(l.custom_fields)) for (const f of l.custom_fields) fields[f.id] = f.value;
    else if (l.custom_fields) Object.assign(fields, l.custom_fields);
    if (!current) {
      const product = await websiteProductFor(l);
      const photos = product ? imageUrls(product).slice(0, 3) : [];
      if (photos.length) {
        fields[PHOTO_FIELD] = photoHtml(photos);
        filled++;
      }
    }
    const keep = ["id", "product_id", "comment", "comment2", "price", "amount", "amount2", "discount", "unit", "cost", "supplier_id", "project_id", "is_internal", "doer_id", "role_id", "vat", "vat_code_id"];
    out.push({ ...Object.fromEntries(keep.filter((k) => l[k] !== undefined && l[k] !== null).map((k) => [k, l[k]])), custom_fields: fields });
  }
  if (!filled) return "nuotraukų pildyti nereikėjo";
  await scoroCall(c, `quotes/modify/${q.id}`, { lines: out });
  return `Scoro #${q.id}: nuotraukos įrašytos ${filled} eilutėms`;
}

/** Scoro prices changed since the last pull → website prices (only products linked to Scoro or with the same code). */
export async function pullPrices(c: ScoroConfig, budgetMs = 120_000): Promise<string> {
  const started = Date.now();
  const from = c.lastPull || "2000-01-01";
  let page = 1;
  let changed = 0;
  let seen = 0;
  for (;;) {
    if (Date.now() - started > budgetMs) return `kainos: peržiūrėta ${seen}, pakeista ${changed}; tęsiama kitą kartą`;
    const rows = (await scoroCall<ScoroProductRow[]>(c, "products/list", {}, { filter: { modified_date: { from_date: from } }, per_page: 100, page })) ?? [];
    for (const r of rows) {
      seen++;
      if (r.price == null || r.is_deleted) continue;
      const gross = toGross(r.price);
      if (gross <= 0) continue;
      const p =
        (await db.product.findUnique({ where: { scoroId: r.product_id }, select: { id: true, priceCents: true } })) ??
        (r.code ? await db.product.findFirst({ where: { sku: { equals: r.code.trim(), mode: "insensitive" } }, select: { id: true, priceCents: true } }) : null);
      if (p && Math.abs(p.priceCents - gross) > 1) {
        await db.product.update({ where: { id: p.id }, data: { priceCents: gross } });
        changed++;
      }
    }
    if (rows.length < 100) break;
    page++;
  }
  await saveScoroConfig({ lastPull: today() });
  return `kainos: peržiūrėta ${seen}, pakeista ${changed}`;
}

/** Subscribes Scoro's quote webhooks to this website (once; existing subscriptions are kept). */
export async function registerWebhooks(c: ScoroConfig): Promise<string> {
  const url = `${siteUrl()}/api/scoro/webhook?token=${encodeURIComponent(c.webhookSecret)}`;
  const list = (await scoroCall<{ id: number; module: string; url: string }[]>(c, "webhooks/list")) ?? [];
  if (list.some((w) => w.module === "quotes" && w.url === url)) return "webhook jau užregistruotas";
  await scoroCall(c, "webhooks/subscribe", { module: "quotes", action: "any", url, owners: ["any"], actors: ["any"] });
  return "webhook užregistruotas";
}

export async function enqueue(kind: "lead" | "quote" | "deactivate", ref: string) {
  await db.scoroTask.upsert({ where: { kind_ref: { kind, ref } }, update: { attempts: 0, lastError: null }, create: { kind, ref } });
}

export type SyncResult = { tasks: number; products: number; checked: number; created: number; failed: number; pendingProducts: number; pendingTasks: number; messages: string[] };

let running = false;

/** Works through queued tasks, then products waiting to be sent, until the time budget runs out. */
export async function runSync(budgetMs = 25_000): Promise<SyncResult> {
  const r: SyncResult = { tasks: 0, products: 0, checked: 0, created: 0, failed: 0, pendingProducts: 0, pendingTasks: 0, messages: [] };
  const c = await scoroConfig();
  if (!isConfigured(c) || running) return r;
  running = true;
  const started = Date.now();
  const left = () => budgetMs - (Date.now() - started);
  try {
    const tasks = await db.scoroTask.findMany({ where: { attempts: { lt: 8 } }, orderBy: { createdAt: "asc" }, take: 100 });
    for (const t of tasks) {
      if (left() < 3000) break;
      const enabled = t.kind === "lead" ? c.pushLeads : t.kind === "quote" ? c.pushQuotes : c.pushProducts;
      if (!enabled) continue;
      try {
        const msg =
          t.kind === "lead"
            ? await pushLead(c, t.ref)
            : t.kind === "quote"
              ? await pushQuote(c, t.ref)
              : (await scoroCall(c, `products/modify/${t.ref}`, { is_active: 0 }), `produktas #${t.ref} išjungtas`);
        await db.scoroTask.delete({ where: { id: t.id } });
        await scoroLog("out", t.kind, true, msg);
        r.tasks++;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await db.scoroTask.update({ where: { id: t.id }, data: { attempts: { increment: 1 }, lastError: msg.slice(0, 500) } });
        await scoroLog("out", t.kind, false, msg);
        r.failed++;
      }
    }
    if (c.pushProducts) {
      const failedIds: string[] = [];
      let checked = 0;
      while (left() > 3000) {
        const batch = await db.product.findMany({
          where: { AND: [pendingProductsWhere(), { id: { notIn: failedIds } }] },
          include: { images: true },
          orderBy: { updatedAt: "asc" },
          take: 10,
        });
        if (!batch.length) break;
        for (const p of batch) {
          if (left() < 2000) break;
          try {
            const res = await syncProduct(c, p);
            if (res.action === "created") r.created++;
            if (res.action !== "unchanged") r.products++;
            checked++;
            r.checked++;
          } catch (e) {
            failedIds.push(p.id);
            r.failed++;
            const msg = `${p.sku ?? p.slug}: ${e instanceof Error ? e.message : String(e)}`;
            r.messages.push(msg);
            await scoroLog("out", "product", false, msg);
          }
        }
      }
      if (r.products) await scoroLog("out", "product", true, `išsiųsta produktų: ${r.products} (naujų Scoro: ${r.created}; patikrinta ${checked})`);
    }
  } finally {
    running = false;
  }
  r.pendingProducts = c.pushProducts ? await db.product.count({ where: pendingProductsWhere() }) : 0;
  r.pendingTasks = await db.scoroTask.count({ where: { attempts: { lt: 8 } } });
  return r;
}

/** True when anything at all should be sent to Scoro (cheap check before scheduling work). */
export async function wantsPush(kind: "product" | "lead" | "quote"): Promise<boolean> {
  const c = await scoroConfig();
  if (!isConfigured(c)) return false;
  return kind === "product" ? c.pushProducts : kind === "lead" ? c.pushLeads : c.pushQuotes;
}

/** Before website products are deleted: products the website created in Scoro get deactivated there (never pre-existing ones). */
export async function queueDeactivations(where: Prisma.ProductWhereInput): Promise<void> {
  if (!(await wantsPush("product").catch(() => false))) return;
  const own = await db.product.findMany({ where: { AND: [where, { scoroId: { not: null } }, { scoroHash: { startsWith: "own:" } }] }, select: { scoroId: true } });
  for (const p of own) if (p.scoroId) await enqueue("deactivate", String(p.scoroId));
}

/** Schedules a short sync after the current response when product sync is on. */
export async function kickProductSync(schedule: (fn: () => Promise<unknown>) => void): Promise<void> {
  if (await wantsPush("product").catch(() => false)) schedule(() => runSync(25_000).catch(() => undefined));
}
