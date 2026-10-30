/**
 * Outgoing email. The provider is picked from env vars:
 *   RESEND_API_KEY — Resend HTTP API (https://resend.com), preferred;
 *   SMTP_URL       — any SMTP server, e.g. "smtps://user:pass@smtp.example.com:465" (nodemailer).
 * MAIL_FROM is the sender, e.g. "Simetria <info@simetria.lt>" (its domain must be verified at the provider).
 *
 * Without a provider, mail is only written to the server console in development (or locally, outside
 * Vercel, when MAIL_DEV_LOG=1) so flows can be tested; in production sending fails with "not_configured".
 */

export type MailMessage = { to: string; subject: string; html: string; text: string };
export type MailResult = { ok: true } | { ok: false; reason: "not_configured" | "failed" };

const DEFAULT_FROM = "Simetria <info@simetria.lt>";

type Provider = "resend" | "smtp" | "console" | null;

function provider(): Provider {
  if (process.env.RESEND_API_KEY) return "resend";
  if (process.env.SMTP_URL) return "smtp";
  const localLog = process.env.MAIL_DEV_LOG === "1" && !process.env.VERCEL;
  if (process.env.NODE_ENV === "development" || localLog) return "console";
  return null;
}

/** Whether emails can be delivered (or, in development, logged). */
export function mailConfigured(): boolean {
  return provider() !== null;
}

export async function sendMail(msg: MailMessage): Promise<MailResult> {
  const from = process.env.MAIL_FROM || DEFAULT_FROM;
  const kind = provider();
  try {
    if (kind === "resend") {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: [msg.to], subject: msg.subject, html: msg.html, text: msg.text }),
      });
      if (!res.ok) {
        console.error(`[mail] Resend error ${res.status}: ${(await res.text()).slice(0, 500)}`);
        return { ok: false, reason: "failed" };
      }
      return { ok: true };
    }
    if (kind === "smtp") {
      const nodemailer = await import("nodemailer");
      const transport = nodemailer.createTransport(process.env.SMTP_URL);
      await transport.sendMail({ from, to: msg.to, subject: msg.subject, html: msg.html, text: msg.text });
      return { ok: true };
    }
    if (kind === "console") {
      console.log(`\n[mail] (not sent — no RESEND_API_KEY / SMTP_URL) to ${msg.to}: ${msg.subject}\n${msg.text}\n`);
      return { ok: true };
    }
    console.error("[mail] No mail provider configured: set RESEND_API_KEY or SMTP_URL (and MAIL_FROM).");
    return { ok: false, reason: "not_configured" };
  } catch (err) {
    console.error("[mail] Sending failed:", err);
    return { ok: false, reason: "failed" };
  }
}
