import { randomUUID } from "node:crypto";
import type { Transporter } from "nodemailer";
import { decryptSecret } from "@/lib/mail-crypto";
import { textToHtml } from "@/lib/mail-parse";
import { endpoint, friendlyMailError, imapflowFactory, type ImapFactory, type MailboxConn } from "@/lib/mail-sync";

/**
 * Sending through a connected mailbox's own SMTP (Gmail: smtp.gmail.com:465 with the app password).
 * Gmail files the message in "Sent" itself, and the client sees an ordinary reply from that address.
 */

export type TransportFactory = (mb: MailboxConn, password: string) => Promise<Pick<Transporter, "sendMail" | "verify" | "close">>;

export const smtpFactory: TransportFactory = async (mb, password) => {
  const nodemailer = await import("nodemailer");
  const ep = endpoint(mb.smtpHost, 465);
  return nodemailer.createTransport({
    host: ep.host,
    port: ep.port,
    secure: ep.secure,
    requireTLS: !ep.secure && !ep.plainLocal,
    ignoreTLS: ep.plainLocal,
    auth: { user: mb.email, pass: password },
    connectionTimeout: 15_000,
    greetingTimeout: 10_000,
    socketTimeout: 30_000,
  });
};

export type OutgoingMail = {
  to: string[];
  cc?: string[];
  subject: string;
  text: string;
  inReplyTo?: string | null;
  references?: string[];
};

/** Sends one plain-text message (with an escaped HTML twin). Returns the Message-ID it was sent with. */
export async function sendFromMailbox(mb: MailboxConn, msg: OutgoingMail, factory: TransportFactory = smtpFactory): Promise<{ messageId: string; date: Date }> {
  const transport = await factory(mb, decryptSecret(mb.passwordEnc));
  const domain = mb.email.split("@")[1] || "simetria.lt";
  const messageId = `<${randomUUID()}@${domain}>`;
  const date = new Date();
  const references = [...(msg.references ?? [])];
  if (msg.inReplyTo && !references.includes(msg.inReplyTo)) references.push(msg.inReplyTo);
  try {
    await transport.sendMail({
      from: mb.displayName ? { name: mb.displayName, address: mb.email } : mb.email,
      to: msg.to,
      cc: msg.cc?.length ? msg.cc : undefined,
      subject: msg.subject,
      text: msg.text,
      html: textToHtml(msg.text),
      messageId,
      date,
      inReplyTo: msg.inReplyTo || undefined,
      references: references.length ? references.slice(-20) : undefined,
    });
  } finally {
    transport.close();
  }
  return { messageId, date };
}

/** IMAP login + SMTP check with a password that is not stored yet. Returns a Lithuanian error or null. */
export async function testMailbox(
  mb: { email: string; imapHost: string; smtpHost: string },
  password: string,
  factories: { imap?: ImapFactory; smtp?: TransportFactory } = {}
): Promise<string | null> {
  const conn: MailboxConn = { ...mb, passwordEnc: "" };
  try {
    const imap = await (factories.imap ?? imapflowFactory)(conn, password);
    await imap.connect();
    await imap.logout().catch(() => imap.close?.());
  } catch (e) {
    return `IMAP: ${friendlyMailError(e)}`;
  }
  try {
    const smtp = await (factories.smtp ?? smtpFactory)(conn, password);
    try {
      await smtp.verify();
    } finally {
      smtp.close();
    }
  } catch (e) {
    return `SMTP: ${friendlyMailError(e)}`;
  }
  return null;
}
