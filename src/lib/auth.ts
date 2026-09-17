import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { db } from "./db";

const COOKIE_NAME = "simetria_session";
const MAX_AGE_S = 60 * 60 * 24 * 7; // 7 days

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET is not set");
  return s;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

function encode(userId: string): string {
  const payload = `${userId}.${Date.now() + MAX_AGE_S * 1000}`;
  return `${payload}.${sign(payload)}`;
}

function decode(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [userId, expiry, sig] = parts;
  const payload = `${userId}.${expiry}`;
  const expected = sign(payload);
  if (
    sig.length !== expected.length ||
    !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
  ) {
    return null;
  }
  if (Number(expiry) < Date.now()) return null;
  return userId;
}

export async function login(email: string, password: string): Promise<boolean> {
  const user = await db.user.findUnique({ where: { email } });
  if (!user) return false;
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return false;
  const store = await cookies();
  store.set(COOKIE_NAME, encode(user.id), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: MAX_AGE_S,
    path: "/",
  });
  return true;
}

export async function logout(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function currentUser() {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const userId = decode(token);
  if (!userId) return null;
  return db.user.findUnique({ where: { id: userId } });
}

/** Guard for admin pages/actions — redirects to the login page when not signed in. */
export async function requireUser() {
  const user = await currentUser();
  if (!user) redirect("/admin/login");
  return user;
}
