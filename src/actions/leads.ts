"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";

const contactSchema = z.object({
  name: z.string().min(1, "Vardas privalomas"),
  email: z.string().email("Neteisingas el. paštas").optional().or(z.literal("")),
  phone: z.string().optional(),
  company: z.string().optional(),
  message: z.string().min(1, "Žinutė privaloma"),
});

/** Public: contact form submission → creates a CRM lead. */
export async function submitContact(
  _prev: { message?: string; error?: string } | undefined,
  formData: FormData
): Promise<{ message?: string; error?: string }> {
  // Honeypot field — bots fill it, humans don't see it.
  if (String(formData.get("website") ?? "")) return { message: "Ačiū!" };

  const parsed = contactSchema.safeParse({
    name: String(formData.get("name") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim(),
    phone: String(formData.get("phone") ?? "").trim(),
    company: String(formData.get("company") ?? "").trim(),
    message: String(formData.get("message") ?? "").trim(),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Patikrinkite formą." };
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
  return { message: "Ačiū! Susisieksime su jumis artimiausiu metu." };
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
