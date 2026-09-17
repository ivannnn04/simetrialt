import { createHmac, timingSafeEqual } from "crypto";

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET is not set");
  return s;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

/** Creates a signed, expiring token for a subject id. */
export function signToken(subject: string, maxAgeSeconds: number): string {
  const payload = `${subject}.${Date.now() + maxAgeSeconds * 1000}`;
  return `${payload}.${sign(payload)}`;
}

/** Returns the subject id if the token is valid and not expired. */
export function verifyToken(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [subject, expiry, sig] = parts;
  const expected = sign(`${subject}.${expiry}`);
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return null;
  }
  if (Number(expiry) < Date.now()) return null;
  return subject;
}

export const cookieOptions = (maxAge: number) => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  maxAge,
  path: "/",
});
