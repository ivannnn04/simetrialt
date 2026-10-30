"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import {
  clearPending,
  loginCustomer,
  logoutCustomer,
  registerCustomer,
  resendPendingCode,
  verifyPendingCode,
  type SendError,
  type VerifyStep,
} from "@/lib/customer-auth";
import { getLocale, getT } from "@/i18n/server";
import type { Dictionary } from "@/i18n/dictionaries";

/** Form state: an error, or the code step ("verify") after the account details were accepted. */
export type AuthState =
  | { error?: string; verify?: { email: string; retryIn: number; kept: boolean }; notice?: string }
  | undefined;

function safeNext(value: FormDataEntryValue | null): string {
  const next = String(value ?? "");
  return next.startsWith("/") && !next.startsWith("//") ? next : "/account/albums";
}

function toState(result: VerifyStep | SendError, t: Dictionary["auth"]): AuthState {
  if ("error" in result) return { error: result.error === "mail_not_configured" ? t.mailNotConfigured : t.mailFailed };
  return { verify: { email: result.verify.email, retryIn: result.verify.retryIn, kept: !result.verify.sent } };
}

export async function registerAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const t = (await getT()).auth;
  const schema = z.object({
    name: z.string().min(2, t.nameRequired),
    email: z.string().email(t.emailInvalid),
    password: z.string().min(8, t.passwordShort),
    company: z.string().optional(),
  });
  const parsed = schema.safeParse({
    name: String(formData.get("name") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
    company: String(formData.get("company") ?? "").trim(),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const result = await registerCustomer(parsed.data, await getLocale());
  if ("error" in result && result.error === "exists") return { error: t.exists };
  return toState(result as VerifyStep | SendError, t);
}

export async function loginCustomerAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const t = (await getT()).auth;
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: t.loginRequired };
  const result = await loginCustomer(email, password, await getLocale());
  if ("ok" in result) redirect(safeNext(formData.get("next")));
  if ("error" in result && result.error === "invalid") return { error: t.invalid };
  return toState(result as VerifyStep | SendError, t);
}

/** Code step: the right code activates the account, signs the visitor in and continues to `next`. */
export async function verifyCodeAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const t = (await getT()).auth;
  const code = String(formData.get("code") ?? "").replace(/\s+/g, "");
  if (!/^\d{6}$/.test(code)) return { error: t.codeFormat };
  const result = await verifyPendingCode(code);
  if (result.ok) redirect(safeNext(formData.get("next")));
  switch (result.reason) {
    case "wrong":
      return { error: t.codeWrong(result.attemptsLeft) };
    case "too_many":
      return { error: t.codeTooMany };
    case "expired":
      return { error: t.codeExpired };
    default:
      return { error: t.noPending };
  }
}

export async function resendCodeAction(): Promise<AuthState> {
  const t = (await getT()).auth;
  const result = await resendPendingCode(await getLocale());
  if ("error" in result && result.error === "no_pending") return { error: t.noPending };
  const state = toState(result as VerifyStep | SendError, t);
  if (state?.verify && !state.verify.kept) state.notice = t.resent(state.verify.email);
  return state;
}

/** "Use a different email" on the code step. */
export async function cancelVerificationAction(): Promise<void> {
  await clearPending();
}

export async function logoutCustomerAction(): Promise<void> {
  await logoutCustomer();
  redirect("/");
}
