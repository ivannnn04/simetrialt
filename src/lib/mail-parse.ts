import { createHash } from "node:crypto";
import type { AddressObject, ParsedMail } from "mailparser";

/**
 * Pure helpers for the CRM mail sync: parsing raw messages, threading, quoted text, bulk-mail
 * detection and the HTML version of outgoing plain-text mail. No IMAP / database access here.
 */

export const MAX_BODY = 100_000;

export type MailAddr = { addr: string; name: string };

export type ParsedEmail = {
  messageId: string;
  from: MailAddr;
  replyTo: string | null;
  to: string[];
  cc: string[];
  subject: string;
  date: Date;
  text: string;
  snippet: string;
  inReplyTo: string | null;
  references: string[];
  /** newsletters, auto-replies, bounces: never turned into new inquiries */
  bulk: boolean;
};

export const normalizeAddr = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

const PREFIX = /^\s*(?:(?:re|fw|fwd|ats|atš|pers|persiųsta|aw|wg|sv|vs|tr|rif|odp|res|antw)(?:\s*\[\d+\])?\s*:\s*)+/i;

/** Subject without "Re:", "Fwd:", "Ats:"… prefixes, lower case, single spaces. */
export function normalizeSubject(subject: string): string {
  let s = subject;
  for (let i = 0; i < 5 && PREFIX.test(s); i++) s = s.replace(PREFIX, "");
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}

export const isReplySubject = (subject: string) => PREFIX.test(subject);

/** All <message-id> tokens of a header value, in order. */
export function messageIds(value: string | string[] | null | undefined): string[] {
  const raw = Array.isArray(value) ? value.join(" ") : value ?? "";
  const ids = raw.match(/<[^<>\s]+>/g);
  if (ids) return ids;
  return raw.split(/\s+/).filter((x) => x.includes("@")).map((x) => `<${x.replace(/^<|>$/g, "")}>`);
}

/** The first message of a conversation: References root, else In-Reply-To, else the message itself. */
export function threadRoot(m: { messageId: string; inReplyTo: string | null; references: string[] }): string {
  return m.references[0] ?? m.inReplyTo ?? m.messageId;
}

const QUOTE_HEADER = /(wrote|rašė|написал\(а\)|написал|schrieb|a écrit|escribió|skrev|kirjoitti|napisał\(a\)|napisał):\s*$/i;

/** Splits a plain-text body into the new part and the quoted older correspondence (collapsed in the UI). */
export function splitQuoted(text: string): { main: string; quoted: string } {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  let cut = -1;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim();
    if (QUOTE_HEADER.test(l) && l.length < 300) {
      // Gmail sometimes wraps "On …, X <x@y>\nwrote:" over two lines
      cut = i > 0 && !/^(on|\d)/i.test(l) && /^(on\s|\d{4}-|\d{1,2}[./])/i.test(lines[i - 1].trim()) ? i - 1 : i;
      break;
    }
    if (/^-{2,}\s*(original message|originalus laiškas|ursprüngliche nachricht|исходное сообщение)\s*-{2,}$/i.test(l)) {
      cut = i;
      break;
    }
    // Outlook: "From: …" followed by "Sent:" / "Date:" a line or two later
    if (/^(from|nuo|von):\s+\S/i.test(l) && lines.slice(i + 1, i + 4).some((x) => /^(sent|date|išsiųsta|data|gesendet):\s/i.test(x.trim()))) {
      cut = i > 0 && /^_{5,}$/.test(lines[i - 1].trim()) ? i - 1 : i;
      break;
    }
    if (l.startsWith(">") && lines.slice(i).every((x) => !x.trim() || x.trim().startsWith(">"))) {
      cut = i;
      break;
    }
  }
  // nothing quoted, or the whole body is a quote (e.g. a bare forward): show it all
  if (cut <= 0) return { main: text.trim(), quoted: "" };
  return { main: lines.slice(0, cut).join("\n").trim(), quoted: lines.slice(cut).join("\n").trim() };
}

export function snippetOf(text: string): string {
  const { main } = splitQuoted(text);
  return (main || text).replace(/\s+/g, " ").trim().slice(0, 200);
}

const NO_REPLY = /^(no-?reply|do-?not-?reply|donotreply|mailer-daemon|postmaster|bounce[s]?|notifications?|newsletter|news|marketing|info-noreply)([+.\-_].*)?$/i;

/** Mail that should never create a new inquiry: lists, newsletters, auto-replies, bounces, no-reply senders. */
export function isBulkMail(headers: Map<string, unknown> | Record<string, unknown>, fromAddr: string): boolean {
  const get = (k: string) => (headers instanceof Map ? headers.get(k) : headers[k]);
  if (get("list-unsubscribe") || get("list-id")) return true;
  const precedence = String(get("precedence") ?? "").toLowerCase();
  if (["bulk", "list", "junk", "auto_reply"].includes(precedence)) return true;
  const auto = String(get("auto-submitted") ?? "").toLowerCase();
  if (auto && auto !== "no") return true;
  if (get("x-autoreply") || get("x-autorespond")) return true;
  const local = fromAddr.split("@")[0] ?? "";
  return !fromAddr || NO_REPLY.test(local);
}

function addrs(value: AddressObject | AddressObject[] | undefined): MailAddr[] {
  const list = Array.isArray(value) ? value : value ? [value] : [];
  const out: MailAddr[] = [];
  for (const obj of list) {
    for (const a of obj.value ?? []) {
      if (a.address) out.push({ addr: normalizeAddr(a.address), name: a.name ?? "" });
      for (const g of a.group ?? []) if (g.address) out.push({ addr: normalizeAddr(g.address), name: g.name ?? "" });
    }
  }
  return out;
}

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n) : s);

/** Fallback id for the rare message without a Message-ID header, stable across runs. */
function syntheticId(parts: string[]): string {
  return `<synthetic-${createHash("sha1").update(parts.join("\u0000")).digest("hex").slice(0, 32)}@simetria.local>`;
}

/** Turns a mailparser result into the fields stored in EmailMessage. */
export function fromParsed(p: ParsedMail): ParsedEmail {
  const from = addrs(p.from)[0] ?? { addr: "", name: "" };
  const subject = clip((p.subject ?? "").trim(), 500);
  const date = p.date && !Number.isNaN(p.date.getTime()) ? p.date : new Date();
  const text = clip((p.text ?? "").replace(/\r\n/g, "\n").replace(/\n{4,}/g, "\n\n\n").trim(), MAX_BODY);
  const references = messageIds(p.references).slice(-50);
  const inReplyTo = messageIds(p.inReplyTo)[0] ?? null;
  const messageId = messageIds(p.messageId)[0] ?? syntheticId([from.addr, date.toISOString(), subject, text.slice(0, 500)]);
  return {
    messageId: clip(messageId, 500),
    from,
    replyTo: addrs(p.replyTo)[0]?.addr ?? null,
    to: addrs(p.to).map((a) => a.addr),
    cc: addrs(p.cc).map((a) => a.addr),
    subject,
    date,
    text,
    snippet: snippetOf(text),
    inReplyTo,
    references,
    bulk: isBulkMail(p.headers as Map<string, unknown>, from.addr),
  };
}

export async function parseRaw(source: Buffer | string): Promise<ParsedEmail> {
  const { simpleParser } = await import("mailparser");
  // attachments are not stored; skipping their content keeps memory low
  const parsed = await simpleParser(source, { skipImageLinks: true, skipTextToHtml: true, skipTextLinks: true });
  return fromParsed(parsed);
}

const escHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** HTML version of a plain-text reply: escaped, line breaks kept. */
export function textToHtml(text: string): string {
  return `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5">${escHtml(text).replace(/\r?\n/g, "<br>\n")}</div>`;
}

/** "Re: …" unless the subject is already a reply. */
export function replySubject(subject: string): string {
  const s = subject.trim();
  if (!s) return "Re:";
  return isReplySubject(s) ? s.replace(PREFIX, "Re: ") : `Re: ${s}`;
}

/** Plain-text quote of the message being answered, Gmail style. */
export function quoteFor(m: { fromName: string; fromAddr: string; date: Date; textBody: string }): string {
  const who = m.fromName ? `${m.fromName} <${m.fromAddr}>` : m.fromAddr;
  const when = m.date.toLocaleString("lt-LT", { timeZone: "Europe/Vilnius", dateStyle: "short", timeStyle: "short" });
  const body = splitQuoted(m.textBody).main || m.textBody;
  return `${when}, ${who} rašė:\n${body.split("\n").map((l) => `> ${l}`).join("\n")}`;
}
