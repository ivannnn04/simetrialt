import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { decryptSecret } from "@/lib/mail-crypto";
import { normalizeAddr, normalizeSubject, parseRaw, threadRoot, isReplySubject, type ParsedEmail } from "@/lib/mail-parse";

/**
 * Gmail → CRM sync over IMAP (app password). For every active mailbox, INBOX and the Sent folder are
 * read: the first run looks at the last 30 days, later runs at UIDs above the last one seen per folder.
 * Only mail with a CRM client (Lead.email or Customer.email) is stored; optionally, new mail from an
 * unknown sender creates an inquiry. Each run is time-bounded and continues where it stopped.
 */

export const AUTO_LEADS_KEY = "mail.autoCreateLeads";
const FIRST_SYNC_DAYS = 30;
const BATCH = 50;
const MAX_SOURCE = 3_000_000; // bytes fetched per message: text parts come first, big attachments are cut
const LOCK_STALE_MS = 3 * 60_000;

// ---------- IMAP client abstraction (imapflow in production, a fake in tests) ----------

export type ImapEnvelope = {
  date?: Date;
  subject?: string;
  messageId?: string;
  inReplyTo?: string;
  from?: { name?: string; address?: string }[];
  to?: { name?: string; address?: string }[];
  cc?: { name?: string; address?: string }[];
  replyTo?: { name?: string; address?: string }[];
};
export type ImapFetched = { uid: number; envelope?: ImapEnvelope; source?: Buffer };
export interface ImapClientLike {
  connect(): Promise<void>;
  logout(): Promise<void>;
  close?(): void;
  list(): Promise<{ path: string; specialUse?: string; flags?: Set<string> }[]>;
  getMailboxLock(path: string): Promise<{ release(): void }>;
  mailbox: false | boolean | { path: string; uidValidity: bigint | number; uidNext: number; exists: number };
  search(query: Record<string, unknown>, options: { uid: true }): Promise<number[] | false | undefined>;
  fetchAll(range: number[] | string, query: Record<string, unknown>, options: { uid: true }): Promise<ImapFetched[]>;
}

export type MailboxConn = { email: string; passwordEnc: string; imapHost: string; smtpHost: string; displayName?: string };
export type ImapFactory = (mb: MailboxConn, password: string) => ImapClientLike | Promise<ImapClientLike>;

const LOOPBACK = new Set(["127.0.0.1", "localhost", "::1"]);

/** "host" or "host:port"; TLS on the standard ports and on every non-local host. */
export function endpoint(hostSpec: string, tlsPort: number): { host: string; port: number; secure: boolean; plainLocal: boolean } {
  const m = hostSpec.trim().match(/^(.*?)(?::(\d{2,5}))?$/);
  const host = (m?.[1] || hostSpec).trim();
  const port = m?.[2] ? Number(m[2]) : tlsPort;
  // cleartext only ever towards a test server on this machine
  const plainLocal = LOOPBACK.has(host) && port !== tlsPort;
  return { host, port, secure: !plainLocal && (port === tlsPort || port === 993 || port === 465), plainLocal };
}

export const imapflowFactory: ImapFactory = async (mb, password) => {
  const { ImapFlow } = await import("imapflow");
  const ep = endpoint(mb.imapHost, 993);
  const client = new ImapFlow({
    host: ep.host,
    port: ep.port,
    secure: ep.secure,
    doSTARTTLS: ep.plainLocal ? false : ep.secure ? undefined : true,
    auth: { user: mb.email, pass: password },
    logger: false,
    disableAutoIdle: true,
    connectionTimeout: 15_000,
    greetingTimeout: 10_000,
    socketTimeout: 60_000,
  });
  // a dropped connection must not crash the process
  client.on("error", () => undefined);
  return client as unknown as ImapClientLike;
};

/** Human (Lithuanian) message for a connection / login failure. Never contains the password. */
export function friendlyMailError(e: unknown): string {
  const err = e as { code?: string; authenticationFailed?: boolean; responseText?: string; serverResponseCode?: string; responseCode?: number; message?: string };
  const text = `${err?.message ?? ""} ${err?.responseText ?? ""} ${err?.serverResponseCode ?? ""} ${err?.code ?? ""}`;
  if (err?.authenticationFailed || /AUTHENTICATIONFAILED|Invalid credentials|EAUTH|535|534|Username and Password not accepted|Application-specific password required/i.test(text))
    return "Gmail nepriėmė prisijungimo: patikrinkite el. pašto adresą ir programos slaptažodį (16 raidžių). Programos slaptažodį reikia sukurti myaccount.google.com/apppasswords, o paskyroje turi būti įjungtas patvirtinimas dviem veiksmais.";
  if (/ENOTFOUND|EAI_AGAIN/i.test(text)) return "Nepavyko rasti pašto serverio (patikrinkite IMAP / SMTP adresą).";
  if (/ECONNREFUSED/i.test(text)) return "Pašto serveris atmetė ryšį (patikrinkite IMAP / SMTP adresą ir prievadą).";
  if (/ETIMEDOUT|timeout|ESOCKET|ECONNRESET|Greeting/i.test(text)) return "Pašto serveris neatsako (baigėsi laukimo laikas). Bandykite vėliau.";
  if (/IMAP.*disabled|not enabled for IMAP|\[ALERT\].*IMAP/i.test(text)) return "Šioje Gmail paskyroje išjungtas IMAP: įjunkite jį Gmail nustatymuose (Persiuntimas ir POP / IMAP).";
  const short = (err?.responseText || err?.message || String(e)).replace(/\s+/g, " ").slice(0, 200);
  return `Pašto serverio klaida: ${short}`;
}

// ---------- matching ----------

type Match = { leadByAddr: Map<string, string>; customerAddrs: Set<string> };

/** Newest lead per address and the addresses of registered customers (case-insensitive). */
export async function findClients(addrs: string[]): Promise<Match> {
  const list = [...new Set(addrs.map(normalizeAddr).filter(Boolean))];
  const leadByAddr = new Map<string, string>();
  const customerAddrs = new Set<string>();
  if (!list.length) return { leadByAddr, customerAddrs };
  const [leads, customers] = await Promise.all([
    db.$queryRaw<{ id: string; email: string }[]>`SELECT id, lower(email) AS email FROM "Lead" WHERE lower(email) = ANY(${list}::text[]) ORDER BY "createdAt" DESC`,
    db.$queryRaw<{ email: string }[]>`SELECT lower(email) AS email FROM "Customer" WHERE lower(email) = ANY(${list}::text[])`,
  ]);
  for (const l of leads) if (!leadByAddr.has(l.email)) leadByAddr.set(l.email, l.id);
  for (const c of customers) customerAddrs.add(c.email);
  return { leadByAddr, customerAddrs };
}

/** Our own addresses (connected mailboxes and staff accounts): never counted as the client side. */
async function ownAddresses(): Promise<Set<string>> {
  const [boxes, users] = await Promise.all([db.mailbox.findMany({ select: { email: true } }), db.user.findMany({ select: { email: true } })]);
  return new Set([...boxes, ...users].map((x) => normalizeAddr(x.email)));
}

const envAddrs = (list: ImapEnvelope["from"]) => (list ?? []).map((a) => normalizeAddr(a.address)).filter(Boolean);

/** The client side of a message: the sender of incoming mail, the recipients of outgoing mail. */
export function counterparts(m: { direction: "IN" | "OUT"; from: string; replyTo?: string | null; to: string[]; cc: string[] }, own: Set<string>): string[] {
  const raw = m.direction === "OUT" ? [...m.to, ...m.cc] : [m.from, m.replyTo ?? ""];
  return [...new Set(raw.map(normalizeAddr).filter((a) => a && !own.has(a)))];
}

// ---------- storing ----------

async function threadKeyFor(p: ParsedEmail, mailboxId: string, leadId: string | null): Promise<string> {
  const related = [...p.references, ...(p.inReplyTo ? [p.inReplyTo] : [])];
  if (related.length) {
    const known = await db.emailMessage.findFirst({ where: { mailboxId, messageId: { in: related } }, select: { threadKey: true }, orderBy: { date: "asc" } });
    if (known) return known.threadKey;
  } else if (leadId && isReplySubject(p.subject)) {
    // a client whose mail program drops the References header: same lead, same subject
    const norm = normalizeSubject(p.subject);
    const same = await db.emailMessage.findMany({ where: { leadId }, select: { subject: true, threadKey: true }, orderBy: { date: "desc" }, take: 50 });
    const hit = same.find((x) => normalizeSubject(x.subject) === norm);
    if (hit) return hit.threadKey;
  }
  return threadRoot(p);
}

export type StoreInput = {
  mailboxId: string;
  parsed: ParsedEmail;
  direction: "IN" | "OUT";
  leadId: string | null;
  /** first (history) sync: imported as already read */
  historical: boolean;
};

/** Saves one message unless this mailbox already has it (Message-ID). Returns true when stored. */
export async function storeMessage({ mailboxId, parsed: p, direction, leadId, historical }: StoreInput): Promise<boolean> {
  if (await db.emailMessage.findUnique({ where: { mailboxId_messageId: { mailboxId, messageId: p.messageId } }, select: { id: true } })) return false;
  if (direction === "OUT") {
    // a reply sent from the admin is saved right away; if Gmail rewrote its Message-ID, do not add it twice
    const twin = await db.emailMessage.findFirst({
      where: { mailboxId, direction: "OUT", subject: p.subject, toAddrs: { hasSome: p.to.length ? p.to : ["-"] }, date: { gte: new Date(p.date.getTime() - 5 * 60_000), lte: new Date(p.date.getTime() + 5 * 60_000) } },
      select: { id: true },
    });
    if (twin) return false;
  }
  const threadKey = await threadKeyFor(p, mailboxId, leadId);
  const r = await db.emailMessage.createMany({
    data: [
      {
        mailboxId,
        messageId: p.messageId,
        threadKey,
        leadId,
        direction,
        fromAddr: p.from.addr,
        fromName: p.from.name.slice(0, 200),
        toAddrs: p.to.slice(0, 50),
        ccAddrs: p.cc.slice(0, 50),
        subject: p.subject,
        date: p.date,
        textBody: p.text,
        snippet: p.snippet,
        inReplyTo: p.inReplyTo,
        references: p.references.join(" "),
        readAt: direction === "OUT" || historical ? new Date() : null,
      },
    ],
    skipDuplicates: true,
  });
  return r.count > 0;
}

/** Creates an inquiry for mail from an unknown sender (setting "Naujas laiškas … sukuria užklausą"). */
async function createLeadFromMail(p: ParsedEmail): Promise<string> {
  const lead = await db.lead.create({
    data: {
      name: (p.from.name || p.from.addr).slice(0, 200),
      email: p.replyTo && p.replyTo !== p.from.addr ? p.replyTo : p.from.addr,
      message: [p.subject && `Laiškas: ${p.subject}`, p.snippet].filter(Boolean).join("\n\n"),
      source: "email",
    },
  });
  return lead.id;
}

// ---------- one mailbox ----------

type FolderState = { uidValidity: string; lastUid: number; initial: boolean };
export type SyncResult = { stored: number; leadsCreated: number; scanned: number; partial: boolean };

/** The folders read: INBOX and the Sent folder (special-use \Sent, any language; "[Gmail]/Sent Mail" as fallback). */
export function foldersToSync(list: { path: string; specialUse?: string; flags?: Set<string> }[]): { path: string; sent: boolean }[] {
  const inbox = list.find((f) => f.path.toUpperCase() === "INBOX" || f.specialUse === "\\Inbox");
  const sent =
    list.find((f) => f.specialUse === "\\Sent" || f.flags?.has("\\Sent")) ??
    list.find((f) => /^\[(gmail|google mail)\]\/sent mail$/i.test(f.path)) ??
    list.find((f) => /^(sent|sent items|sent mail|išsiųsti)$/i.test(f.path));
  return [...(inbox ? [{ path: inbox.path, sent: false }] : [{ path: "INBOX", sent: false }]), ...(sent ? [{ path: sent.path, sent: true }] : [])];
}

export async function syncMailbox(
  mb: { id: string; email: string; passwordEnc: string; imapHost: string; smtpHost: string; syncState: Prisma.JsonValue },
  opts: { deadline: number; factory?: ImapFactory; autoCreate?: boolean }
): Promise<SyncResult> {
  const result: SyncResult = { stored: 0, leadsCreated: 0, scanned: 0, partial: false };
  const autoCreate = opts.autoCreate ?? (await autoCreateLeads());
  const own = await ownAddresses();
  own.add(normalizeAddr(mb.email));
  const state: Record<string, FolderState> = { ...((mb.syncState && typeof mb.syncState === "object" && !Array.isArray(mb.syncState) ? mb.syncState : {}) as Record<string, FolderState>) };
  const saveState = (extra: Prisma.MailboxUpdateInput = {}) => db.mailbox.update({ where: { id: mb.id }, data: { syncState: state as unknown as Prisma.InputJsonValue, ...extra } });

  const client = await (opts.factory ?? imapflowFactory)(mb, decryptSecret(mb.passwordEnc));
  await client.connect();
  try {
    const folders = foldersToSync(await client.list());
    for (const folder of folders) {
      if (Date.now() > opts.deadline) {
        result.partial = true;
        break;
      }
      const lock = await client.getMailboxLock(folder.path);
      try {
        const box = client.mailbox && typeof client.mailbox === "object" ? client.mailbox : null;
        const uidValidity = String(box?.uidValidity ?? "0");
        let st = state[folder.path];
        if (!st || st.uidValidity !== uidValidity) st = state[folder.path] = { uidValidity, lastUid: 0, initial: true };
        const query: Record<string, unknown> = { uid: `${st.lastUid + 1}:*` };
        if (st.initial) query.since = new Date(Date.now() - FIRST_SYNC_DAYS * 24 * 3600 * 1000);
        const found = (await client.search(query, { uid: true })) || [];
        const uids = found.filter((u) => u > st.lastUid).sort((a, b) => a - b);
        let done = true;
        for (let i = 0; i < uids.length; i += BATCH) {
          if (Date.now() > opts.deadline) {
            done = false;
            result.partial = true;
            break;
          }
          const batch = uids.slice(i, i + BATCH);
          const envs = await client.fetchAll(batch, { uid: true, envelope: true }, { uid: true });
          result.scanned += envs.length;
          // decide from the envelope which messages are worth downloading
          const meta = envs.map((e) => {
            const from = envAddrs(e.envelope?.from)[0] ?? "";
            const direction: "IN" | "OUT" = folder.sent || own.has(from) ? "OUT" : "IN";
            const cps = counterparts({ direction, from, replyTo: envAddrs(e.envelope?.replyTo)[0], to: envAddrs(e.envelope?.to), cc: envAddrs(e.envelope?.cc) }, own);
            return { uid: e.uid, direction, cps, messageId: e.envelope?.messageId ?? "" };
          });
          const clients = await findClients(meta.flatMap((m) => m.cps));
          const existing = new Set(
            (await db.emailMessage.findMany({ where: { mailboxId: mb.id, messageId: { in: meta.map((m) => m.messageId).filter(Boolean) } }, select: { messageId: true } })).map((x) => x.messageId)
          );
          const wanted = meta.filter((m) => {
            if (m.messageId && existing.has(m.messageId)) return false;
            if (m.cps.some((a) => clients.leadByAddr.has(a) || clients.customerAddrs.has(a))) return true;
            // unknown sender → new inquiry (new mail only, never the 30-day history)
            return autoCreate && !folder.sent && !st.initial && m.direction === "IN" && m.cps.length > 0;
          });
          if (wanted.length) {
            const sources = await client.fetchAll(
              wanted.map((m) => m.uid),
              { uid: true, source: { maxLength: MAX_SOURCE } },
              { uid: true }
            );
            for (const src of sources) {
              if (!src.source) continue;
              const m = wanted.find((w) => w.uid === src.uid);
              if (!m) continue;
              const parsed = await parseRaw(src.source);
              const cps = counterparts({ direction: m.direction, from: parsed.from.addr, replyTo: parsed.replyTo, to: parsed.to, cc: parsed.cc }, own);
              // the newest lead with one of the client's addresses (a lead created earlier in this run included)
              const fresh = await findClients(cps);
              let leadId = cps.map((a) => fresh.leadByAddr.get(a)).find(Boolean) ?? null;
              const known = Boolean(leadId) || cps.some((a) => fresh.customerAddrs.has(a));
              if (!known) {
                if (!(autoCreate && m.direction === "IN" && !parsed.bulk && !st.initial && !folder.sent)) continue;
                if (await db.emailMessage.findUnique({ where: { mailboxId_messageId: { mailboxId: mb.id, messageId: parsed.messageId } }, select: { id: true } })) continue;
                leadId = await createLeadFromMail(parsed);
                result.leadsCreated++;
              }
              if (await storeMessage({ mailboxId: mb.id, parsed, direction: m.direction, leadId, historical: st.initial })) result.stored++;
            }
          }
          st.lastUid = batch[batch.length - 1];
          await saveState(folder.sent ? {} : { lastUid: st.lastUid });
        }
        if (done) {
          // history read: from now on only new UIDs (uidNext - 1 skips older mail outside the 30 days)
          st.lastUid = Math.max(st.lastUid, (box?.uidNext ?? 1) - 1);
          st.initial = false;
          await saveState(folder.sent ? {} : { lastUid: st.lastUid });
        }
      } finally {
        lock.release();
      }
    }
  } finally {
    await client.logout().catch(() => client.close?.());
  }
  return result;
}

// ---------- all mailboxes ----------

export async function autoCreateLeads(): Promise<boolean> {
  const s = await db.setting.findUnique({ where: { key: AUTO_LEADS_KEY } }).catch(() => null);
  return s?.value === "1";
}

export type RunSummary = { mailbox: string; ok: boolean; result?: SyncResult; error?: string; skipped?: string }[];

/**
 * Syncs the active mailboxes within a time budget. A mailbox is skipped while another run holds it
 * (syncStartedAt) or when it was synced less than minIntervalMs ago.
 */
export async function syncMailboxes(opts: { budgetMs: number; minIntervalMs?: number; mailboxId?: string; factory?: ImapFactory }): Promise<RunSummary> {
  const started = Date.now();
  const deadline = started + opts.budgetMs;
  const summary: RunSummary = [];
  const boxes = await db.mailbox.findMany({ where: { active: true, ...(opts.mailboxId ? { id: opts.mailboxId } : {}) }, orderBy: { lastSyncAt: { sort: "asc", nulls: "first" } } });
  const autoCreate = await autoCreateLeads();
  for (const mb of boxes) {
    if (Date.now() > deadline - 3_000) {
      summary.push({ mailbox: mb.email, ok: true, skipped: "laiko riba" });
      continue;
    }
    const now = new Date();
    const conditions: Prisma.MailboxWhereInput[] = [{ OR: [{ syncStartedAt: null }, { syncStartedAt: { lt: new Date(now.getTime() - LOCK_STALE_MS) } }] }];
    if (opts.minIntervalMs) conditions.push({ OR: [{ lastSyncAt: null }, { lastSyncAt: { lt: new Date(now.getTime() - opts.minIntervalMs) } }] });
    const claimed = await db.mailbox.updateMany({ where: { id: mb.id, active: true, AND: conditions }, data: { syncStartedAt: now } });
    if (!claimed.count) {
      summary.push({ mailbox: mb.email, ok: true, skipped: "neseniai sinchronizuota" });
      continue;
    }
    try {
      const result = await syncMailbox(mb, { deadline, factory: opts.factory, autoCreate });
      await db.mailbox.update({ where: { id: mb.id }, data: { lastSyncAt: new Date(), lastError: null, syncStartedAt: null } });
      summary.push({ mailbox: mb.email, ok: true, result });
    } catch (e) {
      const error = friendlyMailError(e);
      await db.mailbox.update({ where: { id: mb.id }, data: { lastSyncAt: new Date(), lastError: error, syncStartedAt: null } }).catch(() => undefined);
      summary.push({ mailbox: mb.email, ok: false, error });
    }
  }
  return summary;
}

/**
 * Attaches already stored mail with this client's address to a lead that had none (e.g. a lead created
 * after the mail arrived from a registered customer).
 */
export async function linkOrphanMail(leadId: string, email: string | null): Promise<number> {
  const addr = normalizeAddr(email);
  if (!addr) return 0;
  return db.$executeRaw`UPDATE "EmailMessage" SET "leadId" = ${leadId} WHERE "leadId" IS NULL AND ("fromAddr" = ${addr} OR ${addr} = ANY("toAddrs") OR ${addr} = ANY("ccAddrs"))`;
}
