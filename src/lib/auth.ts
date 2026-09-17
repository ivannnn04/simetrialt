import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { cookieOptions, signToken, verifyToken } from "./session";

const COOKIE_NAME = "simetria_session";
const MAX_AGE_S = 60 * 60 * 24 * 7; // 7 days

export async function login(email: string, password: string): Promise<boolean> {
  const user = await db.user.findUnique({ where: { email } });
  if (!user) return false;
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return false;
  const store = await cookies();
  store.set(COOKIE_NAME, signToken(user.id, MAX_AGE_S), cookieOptions(MAX_AGE_S));
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
  const userId = verifyToken(token);
  if (!userId) return null;
  return db.user.findUnique({ where: { id: userId } });
}

/** Guard for admin pages/actions — redirects to the login page when not signed in. */
export async function requireUser() {
  const user = await currentUser();
  if (!user) redirect("/admin/login");
  return user;
}
