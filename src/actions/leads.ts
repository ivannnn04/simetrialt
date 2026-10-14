"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getT } from "@/i18n/server";

const contactSchema = (m: { firstName: string; email: string; message: string }) =>
  z.object({
    name: z.string().min(1, m.firstName),
    email: z.string().email(m.email).optional().or(z.literal("")),
    phone: z.string().optional(),
    company: z.string().optional(),
    message: z.string().min(1, m.message),
  });

/** Public: contact form submission → creates a CRM lead. */
export async function submitContact(
  _prev: { message?: string; error?: string } | undefined,
  formData: FormData
): Promise<{ message?: string; error?: string }> {
  // Honeypot field — bots fill it, humans don't see it.
  const { form } = (await getT()).contactPage;
  if (String(formData.get("website") ?? "")) return { message: form.success };

  const first = String(formData.get("firstName") ?? "").trim();
  const last = String(formData.get("lastName") ?? "").trim();
  const parsed = contactSchema(form.errors).safeParse({
    name: String(formData.get("name") ?? "").trim() || `${first} ${last}`.trim(),
    email: String(formData.get("email") ?? "").trim(),
    phone: String(formData.get("phone") ?? "").trim(),
    company: String(formData.get("company") ?? "").trim(),
    message: String(formData.get("message") ?? "").trim(),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? form.errors.form };
  }
  const d = parsed.data;
  await db.lead.create({
    data: {
      name: d.name,
      email: d.email || null,
      phone: d.phone || null,
      company: d.company || null,
      message: d.message,
      source: "website",
    },
  });
  return { message: form.success };
}

export async function createLead(formData: FormData) {
  await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  await db.lead.create({
    data: {
      name,
      email: String(formData.get("email") ?? "").trim() || null,
      phone: String(formData.get("phone") ?? "").trim() || null,
      company: String(formData.get("company") ?? "").trim() || null,
      message: String(formData.get("message") ?? "").trim(),
      source: "manual",
    },
  });
  revalidatePath("/admin/leads");
}

const STATUSES = ["NEW", "CONTACTED", "QUALIFIED", "WON", "LOST"] as const;

export async function updateLeadStatus(id: string, status: string) {
  await requireUser();
  if (!STATUSES.includes(status as (typeof STATUSES)[number])) return;
  await db.lead.update({ where: { id }, data: { status } });
  revalidatePath(`/admin/leads/${id}`);
  revalidatePath("/admin/leads");
}

export async function addLeadNote(leadId: string, formData: FormData) {
  await requireUser();
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return;
  await db.note.create({ data: { leadId, body } });
  revalidatePath(`/admin/leads/${leadId}`);
}

export async function deleteLead(id: string) {
  await requireUser();
  await db.lead.delete({ where: { id } });
  revalidatePath("/admin/leads");
  redirect("/admin/leads");
}
