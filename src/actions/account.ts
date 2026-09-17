"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { loginCustomer, logoutCustomer, registerCustomer } from "@/lib/customer-auth";

type State = { error?: string } | undefined;

function safeNext(value: FormDataEntryValue | null): string {
  const next = String(value ?? "");
  return next.startsWith("/") && !next.startsWith("//") ? next : "/account/albums";
}

const registerSchema = z.object({
  name: z.string().min(2, "Please enter your name."),
  email: z.string().email("Please enter a valid email."),
  password: z.string().min(8, "Password must be at least 8 characters."),
  company: z.string().optional(),
});

export async function registerAction(_prev: State, formData: FormData): Promise<State> {
  const parsed = registerSchema.safeParse({
    name: String(formData.get("name") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
    company: String(formData.get("company") ?? "").trim(),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const result = await registerCustomer(parsed.data);
  if ("error" in result) return { error: result.error };
  redirect(safeNext(formData.get("next")));
}

export async function loginCustomerAction(_prev: State, formData: FormData): Promise<State> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Please enter your email and password." };
  const ok = await loginCustomer(email, password);
  if (!ok) return { error: "Incorrect email or password." };
  redirect(safeNext(formData.get("next")));
}

export async function logoutCustomerAction(): Promise<void> {
  await logoutCustomer();
  redirect("/");
}
