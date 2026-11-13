import { createHmac, timingSafeEqual } from "crypto";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { sendMail } from "./mail";
import type { Locale } from "@/i18n/config";

/**
 * "Forgot password" links. The token carries the customer id and expiry, signed together with the
 * current password hash — so a link stops working as soon as the password is changed (single use),
 * and nothing has to be stored in the database.
 */

export const RESET_TTL_MS = 60 * 60 * 1000;
const RESEND_AFTER_MS = 60 * 1000;

function sign(customerId: string, expiry: number, passwordHash: string): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set");
  return createHmac("sha256", secret).update(`pwreset:${customerId}:${expiry}:${passwordHash}`).digest("base64url");
}

export function makeResetToken(customer: { id: string; passwordHash: string }, now = Date.now()): string {
  const expiry = now + RESET_TTL_MS;
  return `${customer.id}.${expiry}.${sign(customer.id, expiry, customer.passwordHash)}`;
}

/** The customer a reset link belongs to, or null when it is malformed, expired or already used. */
export async function customerForResetToken(token: string) {
  const [id, exp, sig] = token.split(".");
  const expiry = Number(exp);
  if (!id || !sig || !Number.isFinite(expiry) || expiry < Date.now()) return null;
  const customer = await db.customer.findUnique({ where: { id } });
  if (!customer) return null;
  const expected = Buffer.from(sign(id, expiry, customer.passwordHash));
  const actual = Buffer.from(sig);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  return customer;
}

export type RequestResult = { ok: true } | { ok: false; reason: "not_configured" | "failed" };

/**
 * Emails a reset link when an account with this address exists. The answer is the same whether or not
 * it exists, so the form can't be used to find out who has an account. One email per minute per account.
 */
export async function requestPasswordReset(email: string, locale: Locale, origin: string): Promise<RequestResult> {
  const customer = await db.customer.findUnique({ where: { email: email.toLowerCase() } });
  if (!customer) return { ok: true };
  const key = `pwreset-sent:${customer.id}`;
  const last = await db.setting.findUnique({ where: { key } });
  if (last && Date.now() - Number(last.value) < RESEND_AFTER_MS) return { ok: true };
  const link = `${origin}/account/reset?token=${encodeURIComponent(makeResetToken(customer))}`;
  const result = await sendMail({ to: customer.email, ...resetEmail(link, customer.name, locale) });
  if (!result.ok) return result;
  const value = String(Date.now());
  await db.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
  return { ok: true };
}

/** Sets the new password. Opening the link proves the email is the customer's, so it also counts as verified. */
export async function resetPassword(token: string, password: string): Promise<{ id: string } | null> {
  const customer = await customerForResetToken(token);
  if (!customer) return null;
  const passwordHash = await bcrypt.hash(password, 10);
  // the old hash in the where clause makes two parallel uses of one link impossible
  const updated = await db.customer.updateMany({
    where: { id: customer.id, passwordHash: customer.passwordHash },
    data: { passwordHash, emailVerifiedAt: customer.emailVerifiedAt ?? new Date() },
  });
  if (updated.count === 0) return null;
  await db.customerEmailCode.deleteMany({ where: { customerId: customer.id } });
  return { id: customer.id };
}

// ---------- email ----------

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const COPY = {
  en: {
    subject: "Reset your Simetria password",
    hello: (name: string) => `Hello ${name},`,
    intro: "We received a request to reset the password of your Simetria account. Click the button to choose a new one:",
    button: "Choose a new password",
    expiry: "The link is valid for 1 hour and can be used once.",
    ignore: "If you didn’t ask to reset your password, you can ignore this email — your password stays the same.",
    signature: "Simetria — furniture and lighting solutions",
  },
  lt: {
    subject: "Simetria slaptažodžio atkūrimas",
    hello: (name: string) => `Sveiki, ${name},`,
    intro: "Gavome prašymą atkurti jūsų Simetria paskyros slaptažodį. Paspauskite mygtuką ir susikurkite naują:",
    button: "Sukurti naują slaptažodį",
    expiry: "Nuoroda galioja 1 valandą ir gali būti panaudota vieną kartą.",
    ignore: "Jei slaptažodžio atkurti neprašėte, šį laišką galite ignoruoti – slaptažodis nepasikeis.",
    signature: "Simetria — baldų ir apšvietimo sprendimai",
  },
} satisfies Record<Locale, unknown>;

function resetEmail(link: string, name: string, locale: Locale) {
  const c = COPY[locale] ?? COPY.en;
  const text = [c.hello(name), "", c.intro, "", link, "", c.expiry, c.ignore, "", c.signature, "https://simetria.lt"].join("\n");
  const href = escapeHtml(link);
  const html = `<!doctype html>
<html lang="${locale}">
<body style="margin:0;padding:0;background:#f4f1ea;font-family:Helvetica,Arial,sans-serif;color:#1a1c18;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ea;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;">
        <tr><td style="padding:28px 32px 0;font-size:22px;font-weight:700;letter-spacing:-0.5px;">Simetria</td></tr>
        <tr><td style="padding:24px 32px 0;font-size:16px;line-height:1.5;">
          <p style="margin:0 0 12px;">${escapeHtml(c.hello(name))}</p>
          <p style="margin:0;">${escapeHtml(c.intro)}</p>
        </td></tr>
        <tr><td style="padding:24px 32px;">
          <a href="${href}" style="display:block;background:#1a1c18;color:#ffffff;font-size:16px;font-weight:700;text-align:center;padding:16px 0;text-decoration:none;">${escapeHtml(c.button)}</a>
        </td></tr>
        <tr><td style="padding:0 32px 28px;font-size:14px;line-height:1.5;color:#6b6b6b;">
          <p style="margin:0 0 8px;">${escapeHtml(c.expiry)}</p>
          <p style="margin:0 0 8px;">${escapeHtml(c.ignore)}</p>
          <p style="margin:0;word-break:break-all;font-size:12px;"><a href="${href}" style="color:#909090;">${href}</a></p>
        </td></tr>
        <tr><td style="padding:16px 32px;border-top:1px solid #ece8df;font-size:12px;color:#909090;">
          ${escapeHtml(c.signature)} · <a href="https://simetria.lt" style="color:#909090;">simetria.lt</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  return { subject: c.subject, html, text };
}
