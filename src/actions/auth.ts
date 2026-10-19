"use server";

import { redirect } from "next/navigation";
import { login, logout } from "@/lib/auth";
import { firstLine } from "@/lib/db";

export async function loginAction(
  _prev: { error?: string } | undefined,
  formData: FormData
): Promise<{ error?: string }> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Įveskite el. paštą ir slaptažodį." };
  let ok = false;
  try {
    ok = await login(email, password);
  } catch (e) {
    const detail = firstLine(e);
    console.error("login failed", e);
    return {
      error: `Prisijungti nepavyko: duomenų bazė arba SESSION_SECRET nesukonfigūruoti (${detail}). Patikrinkite aplinkos kintamuosius Vercel nustatymuose.`,
    };
  }
  if (!ok) return { error: "Neteisingi prisijungimo duomenys." };
  redirect("/admin");
}

export async function logoutAction(): Promise<void> {
  await logout();
  redirect("/admin/login");
}
