import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { cookieOptions, signToken, verifyToken } from "./session";
import { mailConfigured } from "./mail";
import { checkCode, issueCode, resendWaitSeconds, type CheckResult } from "./email-verification";
import type { Locale } from "@/i18n/config";

const COOKIE_NAME = "simetria_customer";
const MAX_AGE_S = 60 * 60 * 24 * 30; // 30 days

async function setSession(customerId: string) {
  const store = await cookies();
  store.set(COOKIE_NAME, signToken(customerId, MAX_AGE_S), cookieOptions(MAX_AGE_S));
}

/** Account waiting for its email code: remembered in a short-lived cookie between the form and the code step. */
const PENDING_COOKIE = "simetria_customer_pending";
const PENDING_MAX_AGE_S = 60 * 30;

async function setPending(customerId: string) {
  const store = await cookies();
  store.set(PENDING_COOKIE, signToken(customerId, PENDING_MAX_AGE_S), cookieOptions(PENDING_MAX_AGE_S));
}

async function pendingCustomer() {
  const store = await cookies();
  const token = store.get(PENDING_COOKIE)?.value;
  const id = token ? verifyToken(token) : null;
  if (!id) return null;
  const customer = await db.customer.findUnique({ where: { id } });
  return customer && !customer.emailVerifiedAt ? customer : null;
}

export async function clearPending(): Promise<void> {
  const store = await cookies();
  store.delete(PENDING_COOKIE);
}

/** The account waiting for its code in this browser, if any (shows the code step after a reload). */
export async function pendingVerification(): Promise<{ email: string; retryIn: number } | null> {
  const customer = await pendingCustomer().catch(() => null);
  if (!customer) return null;
  return { email: customer.email, retryIn: await resendWaitSeconds(customer.id) };
}

export type VerifyStep = { verify: { email: string; retryIn: number; sent: boolean } };
export type SendError = { error: "mail_not_configured" | "mail_failed" };

async function startVerification(
  customer: { id: string; email: string; name: string },
  locale: Locale
): Promise<VerifyStep | SendError> {
  const sent = await issueCode(customer, locale);
  if (!sent.ok) return { error: sent.reason === "not_configured" ? "mail_not_configured" : "mail_failed" };
  await setPending(customer.id);
  return { verify: { email: customer.email, retryIn: sent.retryIn, sent: sent.sent } };
}

/**
 * Creates the account as unverified and emails a 6-digit code. The visitor is signed in only after
 * entering the code (see verifyPendingCode). An unfinished registration for the same email is
 * replaced, so an address typed by someone else can't block the real owner.
 */
export async function registerCustomer(
  input: { name: string; email: string; password: string; company?: string },
  locale: Locale
): Promise<VerifyStep | SendError | { error: "exists" }> {
  const email = input.email.toLowerCase();
  if (!mailConfigured()) return { error: "mail_not_configured" };
  const exists = await db.customer.findUnique({ where: { email } });
  if (exists?.emailVerifiedAt) return { error: "exists" };
  const data = { name: input.name, company: input.company || null, passwordHash: await bcrypt.hash(input.password, 10) };
  const customer = exists
    ? await db.customer.update({ where: { id: exists.id }, data })
    : await db.customer.create({ data: { email, ...data } });
  return startVerification(customer, locale);
}

/** Signs in a verified customer; an unverified one gets (or keeps) a code and goes to the code step. */
export async function loginCustomer(
  email: string,
  password: string,
  locale: Locale
): Promise<{ ok: true } | { error: "invalid" } | VerifyStep | SendError> {
  const customer = await db.customer.findUnique({ where: { email: email.toLowerCase() } });
  if (!customer || !customer.passwordHash) return { error: "invalid" };
  const ok = await bcrypt.compare(password, customer.passwordHash);
  if (!ok) return { error: "invalid" };
  if (!customer.emailVerifiedAt) return startVerification(customer, locale);
  await clearPending();
  await setSession(customer.id);
  return { ok: true };
}

/** Code step: on the right code the account becomes active and the visitor is signed in. */
export async function verifyPendingCode(code: string): Promise<CheckResult | { ok: false; reason: "no_pending" }> {
  const customer = await pendingCustomer();
  if (!customer) return { ok: false, reason: "no_pending" };
  const result = await checkCode(customer.id, code);
  if (result.ok) {
    await clearPending();
    await setSession(customer.id);
  }
  return result;
}

/** "Send a new code" on the code step (at most once a minute). */
export async function resendPendingCode(locale: Locale): Promise<VerifyStep | SendError | { error: "no_pending" }> {
  const customer = await pendingCustomer();
  if (!customer) return { error: "no_pending" };
  return startVerification(customer, locale);
}

export async function logoutCustomer(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function currentCustomer() {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const id = verifyToken(token);
  if (!id) return null;
  try {
    const customer = await db.customer.findUnique({ where: { id } });
    return customer?.emailVerifiedAt ? customer : null;
  } catch {
    return null;
  }
}

/** Guard for account pages — sends anonymous visitors to the login page and back afterwards. */
export async function requireCustomer(next = "/account/albums") {
  const customer = await currentCustomer();
  // keep the visitor's language: "/lt/account/albums" → "/lt/account/login"
  const prefix = next.match(/^\/(lt)(\/|$)/)?.[1];
  if (!customer) redirect(`${prefix ? `/${prefix}` : ""}/account/login?next=${encodeURIComponent(next)}`);
  return customer;
}

const GUEST_EMAIL = "guest@simetria.local";

/**
 * TEMPORARY: while the site is being built, sign-in is not enforced. Anonymous visitors act as
 * a shared "Guest" customer so albums, hearts and quantities work without an account.
 */
export async function currentOrGuestCustomer() {
  const customer = await currentCustomer();
  if (customer) return customer;
  return db.customer.upsert({
    where: { email: GUEST_EMAIL },
    update: {},
    create: { email: GUEST_EMAIL, name: "Guest", passwordHash: "", emailVerifiedAt: new Date() },
  });
}
