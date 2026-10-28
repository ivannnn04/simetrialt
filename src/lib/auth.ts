import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { cookieOptions, signToken, verifyToken } from "./session";

const COOKIE_NAME = "simetria_session";
const MAX_AGE_S = 60 * 60 * 24 * 7; // 7 days

export async function login(email: string, password: string): Promise<boolean> {
  const user = await db.user.findUnique({ where: { email: email.toLowerCase() } });
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
  try {
    return await db.user.findUnique({ where: { id: userId } });
  } catch (e) {
    console.error("currentUser: database unavailable", e instanceof Error ? e.message : e);
    return null;
  }
}

/** Guard for admin pages/actions — redirects to the login page when not signed in. */
export async function requireUser() {
  const user = await currentUser();
  if (!user) redirect("/admin/login");
  return user;
}

export type Role = "ADMIN" | "EDITOR" | "SHOWROOM";
export const ROLE_LABELS: Record<Role, string> = { ADMIN: "Administratorius", EDITOR: "Redaktorius", SHOWROOM: "Salono vadybininkas" };

/** The first page of the admin area for a role: showroom managers land on their quotes. */
export const homeFor = (role: string) => (role === "SHOWROOM" ? "/admin/quotes" : "/admin");

/** Guard for pages/actions reserved to some roles; others are sent to their own start page. */
export async function requireRole(...roles: Role[]) {
  const user = await requireUser();
  if (!roles.includes(user.role as Role)) redirect(homeFor(user.role));
  return user;
}

/** Content and catalogue management: administrators and editors. */
export const requireEditor = () => requireRole("ADMIN", "EDITOR");
/** User management: the super admin only. */
export const requireAdmin = () => requireRole("ADMIN");
