"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";

const MIN_PASSWORD = 8;

type Result = { error?: string; ok?: string };

export async function createUser(_prev: Result | undefined, formData: FormData): Promise<Result> {
  await requireUser();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "ADMIN") === "EDITOR" ? "EDITOR" : "ADMIN";
  if (!email || !name) return { error: "Įveskite vardą ir el. paštą." };
  if (password.length < MIN_PASSWORD) return { error: `Slaptažodis turi būti bent ${MIN_PASSWORD} simbolių.` };
  if (await db.user.findUnique({ where: { email } })) return { error: "Toks el. paštas jau užregistruotas." };
  await db.user.create({ data: { email, name, role, passwordHash: await bcrypt.hash(password, 10) } });
  revalidatePath("/admin/users");
  return { ok: `Vartotojas ${email} sukurtas.` };
}

export async function changePassword(_prev: Result | undefined, formData: FormData): Promise<Result> {
  const me = await requireUser();
  const userId = String(formData.get("userId") ?? me.id);
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password.length < MIN_PASSWORD) return { error: `Slaptažodis turi būti bent ${MIN_PASSWORD} simbolių.` };
  if (password !== confirm) return { error: "Slaptažodžiai nesutampa." };
  await db.user.update({ where: { id: userId }, data: { passwordHash: await bcrypt.hash(password, 10) } });
  revalidatePath("/admin/users");
  return { ok: "Slaptažodis pakeistas." };
}

export async function deleteUser(id: string) {
  const me = await requireUser();
  if (id === me.id) return;
  if ((await db.user.count()) <= 1) return;
  await db.user.delete({ where: { id } });
  revalidatePath("/admin/users");
  redirect("/admin/users");
}
