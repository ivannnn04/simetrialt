"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { encryptSecret } from "@/lib/mail-crypto";
import { testMailbox } from "@/lib/mail-send";
import { AUTO_LEADS_KEY, syncMailboxes, type RunSummary } from "@/lib/mail-sync";

type Msg = { ok?: string; error?: string };

const PATH = "/admin/mailboxes";
const host = (v: FormDataEntryValue | null, def: string) => String(v ?? "").trim().replace(/^[a-z]+:\/\//i, "").replace(/\/.*$/, "") || def;
/** Google shows app passwords as "abcd efgh ijkl mnop": the spaces are not part of it. */
const cleanPassword = (v: FormDataEntryValue | null) => String(v ?? "").replace(/\s+/g, "");

const emailSchema = z.string().trim().toLowerCase().email();

export async function addMailbox(_prev: Msg | undefined, formData: FormData): Promise<Msg> {
  await requireAdmin();
  const email = emailSchema.safeParse(formData.get("email"));
  if (!email.success) return { error: "Įveskite teisingą el. pašto adresą." };
  const password = cleanPassword(formData.get("password"));
  if (password.length < 8) return { error: "Įveskite programos slaptažodį (16 raidžių iš myaccount.google.com/apppasswords)." };
  if (await db.mailbox.findUnique({ where: { email: email.data } })) return { error: "Ši dėžutė jau prijungta." };
  const ownerUserId = String(formData.get("ownerUserId") ?? "") || null;
  const data = {
    email: email.data,
    displayName: String(formData.get("displayName") ?? "").trim().slice(0, 100),
    imapHost: host(formData.get("imapHost"), "imap.gmail.com"),
    smtpHost: host(formData.get("smtpHost"), "smtp.gmail.com"),
  };
  const error = await testMailbox(data, password);
  if (error) return { error };
  const mb = await db.mailbox.create({ data: { ...data, ownerUserId, passwordEnc: encryptSecret(password) } });
  // first sync (last 30 days) after the response
  after(() => syncMailboxes({ budgetMs: 40_000, mailboxId: mb.id }).catch(() => undefined));
  revalidatePath(PATH);
  return { ok: `Prijungta: ${mb.email}. Pirmasis sinchronizavimas (paskutinės 30 dienų) vyksta fone.` };
}

/** New app password for an existing mailbox (e.g. the old one was revoked). Tested before saving. */
export async function changeMailboxPassword(id: string, _prev: Msg | undefined, formData: FormData): Promise<Msg> {
  await requireAdmin();
  const mb = await db.mailbox.findUnique({ where: { id } });
  if (!mb) return { error: "Dėžutė nerasta." };
  const password = cleanPassword(formData.get("password"));
  if (password.length < 8) return { error: "Įveskite naują programos slaptažodį." };
  const error = await testMailbox(mb, password);
  if (error) return { error };
  await db.mailbox.update({ where: { id }, data: { passwordEnc: encryptSecret(password), lastError: null } });
  revalidatePath(PATH);
  return { ok: "Slaptažodis pakeistas, ryšys veikia." };
}

export async function setMailboxOwner(id: string, ownerUserId: string): Promise<void> {
  await requireAdmin();
  await db.mailbox.update({ where: { id }, data: { ownerUserId: ownerUserId || null } });
  revalidatePath(PATH);
}

export async function setMailboxActive(id: string, active: boolean): Promise<void> {
  await requireAdmin();
  await db.mailbox.update({ where: { id }, data: { active, ...(active ? {} : { syncStartedAt: null }) } });
  revalidatePath(PATH);
}

/** Removes the mailbox, its encrypted password and the mail copied from it. */
export async function deleteMailbox(id: string): Promise<void> {
  await requireAdmin();
  await db.mailbox.delete({ where: { id } }).catch(() => undefined);
  revalidatePath(PATH);
  revalidatePath("/admin/leads");
}

export async function setAutoCreateLeads(on: boolean): Promise<void> {
  await requireAdmin();
  await db.setting.upsert({ where: { key: AUTO_LEADS_KEY }, create: { key: AUTO_LEADS_KEY, value: on ? "1" : "0" }, update: { value: on ? "1" : "0" } });
  revalidatePath(PATH);
}

const describe = (s: RunSummary) =>
  s
    .map((r) =>
      r.error
        ? `${r.mailbox}: ${r.error}`
        : r.skipped
          ? `${r.mailbox}: praleista (${r.skipped})`
          : `${r.mailbox}: peržiūrėta ${r.result?.scanned ?? 0}, išsaugota ${r.result?.stored ?? 0}${r.result?.leadsCreated ? `, naujų užklausų ${r.result.leadsCreated}` : ""}${r.result?.partial ? " (tęsiama kitą kartą)" : ""}`
    )
    .join("\n");

export async function syncMailboxNow(id?: string): Promise<Msg> {
  await requireAdmin();
  const summary = await syncMailboxes({ budgetMs: 40_000, mailboxId: id });
  revalidatePath(PATH);
  revalidatePath("/admin/leads");
  if (!summary.length) return { error: "Nėra aktyvių dėžučių." };
  const failed = summary.some((r) => !r.ok);
  return failed ? { error: describe(summary) } : { ok: describe(summary) };
}
