import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { cookieOptions, signToken, verifyToken } from "./session";

const COOKIE_NAME = "simetria_customer";
const MAX_AGE_S = 60 * 60 * 24 * 30; // 30 days

async function setSession(customerId: string) {
  const store = await cookies();
  store.set(COOKIE_NAME, signToken(customerId, MAX_AGE_S), cookieOptions(MAX_AGE_S));
}

export async function registerCustomer(input: { name: string; email: string; password: string; company?: string }) {
  const email = input.email.toLowerCase();
  const exists = await db.customer.findUnique({ where: { email } });
  if (exists) return { error: "An account with this email already exists." };
  const customer = await db.customer.create({
    data: {
      email,
      name: input.name,
      company: input.company || null,
      passwordHash: await bcrypt.hash(input.password, 10),
    },
  });
  await setSession(customer.id);
  return { ok: true as const };
}

export async function loginCustomer(email: string, password: string): Promise<boolean> {
  const customer = await db.customer.findUnique({ where: { email: email.toLowerCase() } });
  if (!customer) return false;
  const ok = await bcrypt.compare(password, customer.passwordHash);
  if (!ok) return false;
  await setSession(customer.id);
  return true;
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
    return await db.customer.findUnique({ where: { id } });
  } catch {
    return null;
  }
}

/** Guard for account pages — sends anonymous visitors to the login page and back afterwards. */
export async function requireCustomer(next = "/account/albums") {
  const customer = await currentCustomer();
  if (!customer) redirect(`/account/login?next=${encodeURIComponent(next)}`);
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
    create: { email: GUEST_EMAIL, name: "Guest", passwordHash: "" },
  });
}
