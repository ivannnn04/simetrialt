import { createHmac, randomInt, timingSafeEqual } from "crypto";
import { db } from "./db";
import { sendMail } from "./mail";
import type { Locale } from "@/i18n/config";

/** 6-digit email codes that confirm a new customer account. Only an HMAC of the code is stored. */

export const CODE_TTL_MS = 15 * 60 * 1000;
export const CODE_MAX_ATTEMPTS = 5;
export const RESEND_AFTER_S = 60;

function hashCode(customerId: string, code: string): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set");
  return createHmac("sha256", secret).update(`email-code:${customerId}:${code}`).digest("hex");
}

/** Seconds until another code may be sent (0 = now). */
export async function resendWaitSeconds(customerId: string): Promise<number> {
  const row = await db.customerEmailCode.findUnique({ where: { customerId }, select: { sentAt: true } });
  if (!row) return 0;
  const left = RESEND_AFTER_S - Math.floor((Date.now() - row.sentAt.getTime()) / 1000);
  return Math.max(0, left);
}

export type IssueResult =
  | { ok: true; retryIn: number; sent: boolean }
  | { ok: false; reason: "not_configured" | "failed" };

/**
 * Creates a fresh code and emails it. When a code was sent less than a minute ago, nothing is sent
 * (the visitor keeps using that code) and `sent` is false.
 */
export async function issueCode(
  customer: { id: string; email: string; name: string },
  locale: Locale
): Promise<IssueResult> {
  const wait = await resendWaitSeconds(customer.id);
  if (wait > 0) return { ok: true, retryIn: wait, sent: false };

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const data = {
    codeHash: hashCode(customer.id, code),
    expiresAt: new Date(Date.now() + CODE_TTL_MS),
    attempts: 0,
    sentAt: new Date(),
  };
  await db.customerEmailCode.upsert({ where: { customerId: customer.id }, create: { customerId: customer.id, ...data }, update: data });

  const result = await sendMail({ to: customer.email, ...codeEmail(code, customer.name, locale) });
  if (!result.ok) {
    // let the visitor retry straight away instead of waiting for a code that never arrived
    await db.customerEmailCode.deleteMany({ where: { customerId: customer.id } });
    return { ok: false, reason: result.reason };
  }
  return { ok: true, retryIn: RESEND_AFTER_S, sent: true };
}

export type CheckResult =
  | { ok: true }
  | { ok: false; reason: "expired" | "too_many" }
  | { ok: false; reason: "wrong"; attemptsLeft: number };

/** Checks a code; on success the customer is marked verified and the code is removed. */
export async function checkCode(customerId: string, input: string): Promise<CheckResult> {
  const row = await db.customerEmailCode.findUnique({ where: { customerId } });
  if (!row || row.expiresAt.getTime() < Date.now()) return { ok: false, reason: "expired" };
  if (row.attempts >= CODE_MAX_ATTEMPTS) return { ok: false, reason: "too_many" };

  const expected = Buffer.from(row.codeHash);
  const actual = Buffer.from(hashCode(customerId, input));
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    // count the attempt atomically so parallel guesses can't exceed the limit
    const counted = await db.customerEmailCode.updateMany({
      where: { id: row.id, attempts: { lt: CODE_MAX_ATTEMPTS } },
      data: { attempts: { increment: 1 } },
    });
    if (counted.count === 0) return { ok: false, reason: "too_many" };
    const left = CODE_MAX_ATTEMPTS - (row.attempts + 1);
    return left > 0 ? { ok: false, reason: "wrong", attemptsLeft: left } : { ok: false, reason: "too_many" };
  }

  await db.$transaction([
    db.customer.update({ where: { id: customerId }, data: { emailVerifiedAt: new Date() } }),
    db.customerEmailCode.deleteMany({ where: { customerId } }),
  ]);
  return { ok: true };
}

// ---------- email ----------

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const COPY = {
  en: {
    subject: (code: string) => `${code} is your Simetria confirmation code`,
    hello: (name: string) => `Hello ${name},`,
    intro: "Use this code to confirm your email and finish creating your Simetria account:",
    expiry: "The code is valid for 15 minutes.",
    ignore: "If you did not create an account on simetria.lt, you can ignore this email.",
    signature: "Simetria — furniture and lighting solutions",
  },
  lt: {
    subject: (code: string) => `${code} – jūsų Simetria patvirtinimo kodas`,
    hello: (name: string) => `Sveiki, ${name},`,
    intro: "Įveskite šį kodą, kad patvirtintumėte el. pašto adresą ir užbaigtumėte Simetria paskyros kūrimą:",
    expiry: "Kodas galioja 15 minučių.",
    ignore: "Jei paskyros simetria.lt nekūrėte, šį laišką galite ignoruoti.",
    signature: "Simetria — baldų ir apšvietimo sprendimai",
  },
} satisfies Record<Locale, unknown>;

function codeEmail(code: string, name: string, locale: Locale) {
  const c = COPY[locale] ?? COPY.en;
  const text = [c.hello(name), "", c.intro, "", code, "", c.expiry, c.ignore, "", c.signature, "https://simetria.lt"].join("\n");
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
          <div style="background:#1a1c18;color:#ffffff;font-size:34px;font-weight:700;letter-spacing:10px;text-align:center;padding:18px 0;">${code}</div>
        </td></tr>
        <tr><td style="padding:0 32px 28px;font-size:14px;line-height:1.5;color:#6b6b6b;">
          <p style="margin:0 0 8px;">${escapeHtml(c.expiry)}</p>
          <p style="margin:0;">${escapeHtml(c.ignore)}</p>
        </td></tr>
        <tr><td style="padding:16px 32px;border-top:1px solid #ece8df;font-size:12px;color:#909090;">
          ${escapeHtml(c.signature)} · <a href="https://simetria.lt" style="color:#909090;">simetria.lt</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  return { subject: c.subject(code), html, text };
}
