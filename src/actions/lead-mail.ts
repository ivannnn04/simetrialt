"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireEditor } from "@/lib/auth";
import { db } from "@/lib/db";
import { messageIds, normalizeAddr, quoteFor, snippetOf, MAX_BODY } from "@/lib/mail-parse";
import { sendFromMailbox } from "@/lib/mail-send";
import { friendlyMailError, syncMailboxes } from "@/lib/mail-sync";

export type SendState = { ok?: string; error?: string };

const addrList = (v: FormDataEntryValue | null) =>
  String(v ?? "")
    .split(/[,;\s]+/)
    .map(normalizeAddr)
    .filter(Boolean);

/** Reply to (or start) a conversation with a lead from a connected mailbox; the sent mail is stored as OUT. */
export async function sendLeadEmail(_prev: SendState | undefined, formData: FormData): Promise<SendState> {
  await requireEditor();
  const leadId = String(formData.get("leadId") ?? "");
  const lead = await db.lead.findUnique({ where: { id: leadId }, select: { id: true } });
  if (!lead) return { error: "Užklausa nerasta." };
  const mailbox = await db.mailbox.findFirst({ where: { id: String(formData.get("mailboxId") ?? ""), active: true } });
  if (!mailbox) return { error: "Pasirinkite aktyvią pašto dėžutę." };
  const to = addrList(formData.get("to"));
  const cc = addrList(formData.get("cc"));
  if (!to.length || [...to, ...cc].some((a) => !z.string().email().safeParse(a).success)) return { error: "Patikrinkite gavėjo el. pašto adresą." };
  const subject = String(formData.get("subject") ?? "").replace(/[\r\n]+/g, " ").trim().slice(0, 300);
  if (!subject) return { error: "Įveskite temą." };
  const body = String(formData.get("text") ?? "").replace(/\r\n/g, "\n").trimEnd();
  if (!body.trim()) return { error: "Laiškas tuščias." };

  const parentId = String(formData.get("replyToId") ?? "");
  const parent = parentId ? await db.emailMessage.findFirst({ where: { id: parentId, leadId } }) : null;
  const text = parent && formData.get("quote") === "on" ? `${body}\n\n${quoteFor(parent)}` : body;
  const references = parent ? [...messageIds(parent.references), parent.messageId] : [];
  // a parent without References (some Outlook clients): the conversation root keeps Gmail's thread together
  if (parent && !references.includes(parent.threadKey) && /^<[^<>\s]+@[^<>\s]+>$/.test(parent.threadKey) && !parent.threadKey.startsWith("<synthetic-")) references.unshift(parent.threadKey);

  let sent: { messageId: string; date: Date };
  try {
    sent = await sendFromMailbox(mailbox, { to, cc, subject, text, inReplyTo: parent?.messageId ?? null, references });
  } catch (e) {
    return { error: `Laiškas neišsiųstas. ${friendlyMailError(e)}` };
  }
  await db.emailMessage.create({
    data: {
      mailboxId: mailbox.id,
      messageId: sent.messageId,
      threadKey: parent?.threadKey ?? sent.messageId,
      leadId,
      direction: "OUT",
      fromAddr: normalizeAddr(mailbox.email),
      fromName: mailbox.displayName,
      toAddrs: to,
      ccAddrs: cc,
      subject,
      date: sent.date,
      textBody: text.slice(0, MAX_BODY),
      snippet: snippetOf(body),
      inReplyTo: parent?.messageId ?? null,
      references: references.join(" "),
      readAt: sent.date,
    },
  });
  revalidatePath(`/admin/leads/${leadId}`);
  revalidatePath("/admin/leads");
  return { ok: `Išsiųsta: ${to.join(", ")}` };
}

/** "Tikrinti naujus laiškus" on a lead page: a short sync of every mailbox not synced in the last 15 s. */
export async function refreshLeadMail(leadId: string): Promise<{ ok?: string; error?: string }> {
  await requireEditor();
  const summary = await syncMailboxes({ budgetMs: 25_000, minIntervalMs: 15_000 });
  revalidatePath(`/admin/leads/${leadId}`);
  const err = summary.find((r) => r.error);
  if (err) return { error: `${err.mailbox}: ${err.error}` };
  const stored = summary.reduce((n, r) => n + (r.result?.stored ?? 0), 0);
  return { ok: stored ? `Nauji laiškai: ${stored}` : "Naujų laiškų nėra." };
}
