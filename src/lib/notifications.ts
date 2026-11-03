import { db } from "@/lib/db";
import { sendMail, mailConfigured } from "@/lib/mail";

/**
 * Staff notifications: website inquiries, e-mails from CRM clients not opened yet (and, for
 * administrators, new client accounts) newer than the moment the user last opened the bell are unread.
 * Nothing is stored per event.
 */

export type AdminNotification = { id: string; kind: "lead" | "customer" | "email"; title: string; body: string; href: string; at: string; unread: boolean };

const canSeeLeads = (role: string) => role === "ADMIN" || role === "EDITOR";

export async function notificationsFor(user: { id: string; role: string; notificationsSeenAt: Date | null }): Promise<{ unread: number; items: AdminNotification[] }> {
  if (!canSeeLeads(user.role)) return { unread: 0, items: [] };
  // first use: only the last 7 days count as unread
  const seen = user.notificationsSeenAt ?? new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const unreadMailWhere = { direction: "IN", leadId: { not: null }, readAt: null, createdAt: { gt: seen } };
  const [leads, unreadLeads, customers, unreadCustomers, mails, unreadMails] = await Promise.all([
    db.lead.findMany({ where: { source: "website" }, orderBy: { createdAt: "desc" }, take: 15, select: { id: true, name: true, message: true, productSku: true, createdAt: true } }),
    db.lead.count({ where: { source: "website", createdAt: { gt: seen } } }),
    user.role === "ADMIN"
      ? db.customer.findMany({ where: { emailVerifiedAt: { not: null } }, orderBy: { createdAt: "desc" }, take: 5, select: { id: true, name: true, email: true, createdAt: true } })
      : Promise.resolve([]),
    user.role === "ADMIN" ? db.customer.count({ where: { emailVerifiedAt: { not: null }, createdAt: { gt: seen } } }) : Promise.resolve(0),
    // incoming mail linked to a lead and not opened yet (the history imported by a first sync is already read)
    db.emailMessage
      .findMany({
        where: { direction: "IN", leadId: { not: null }, readAt: null },
        orderBy: { createdAt: "desc" },
        take: 15,
        select: { id: true, subject: true, snippet: true, fromName: true, fromAddr: true, date: true, createdAt: true, leadId: true, lead: { select: { name: true } } },
      })
      .catch(() => []),
    db.emailMessage.count({ where: unreadMailWhere }).catch(() => 0),
  ]);
  const items: AdminNotification[] = [
    ...leads.map((l) => ({
      id: `lead-${l.id}`,
      kind: "lead" as const,
      title: `Nauja užklausa: ${l.name}`,
      body: (l.productSku ? `Produktas ${l.productSku} · ` : "") + l.message.replace(/\s+/g, " ").slice(0, 140),
      href: `/admin/leads/${l.id}`,
      at: l.createdAt.toISOString(),
      unread: l.createdAt > seen,
    })),
    ...mails.map((m) => ({
      id: `email-${m.id}`,
      kind: "email" as const,
      title: `Naujas laiškas: ${m.lead?.name || m.fromName || m.fromAddr}`,
      body: [m.subject, m.snippet].filter(Boolean).join(" – ").slice(0, 160),
      href: `/admin/leads/${m.leadId}`,
      at: m.createdAt.toISOString(),
      unread: m.createdAt > seen,
    })),
    ...customers.map((c) => ({
      id: `customer-${c.id}`,
      kind: "customer" as const,
      title: `Naujas registruotas klientas: ${c.name}`,
      body: c.email,
      href: "/admin/customers",
      at: c.createdAt.toISOString(),
      unread: c.createdAt > seen,
    })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 15);
  return { unread: unreadLeads + unreadCustomers + unreadMails, items };
}

export async function markNotificationsSeen(userId: string): Promise<void> {
  await db.user.update({ where: { id: userId }, data: { notificationsSeenAt: new Date() } });
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/**
 * E-mails a new website inquiry to the team: LEADS_NOTIFY_EMAIL (comma-separated) or, if not set,
 * every administrator and editor. Skipped quietly when no mail provider is configured.
 */
export async function emailNewLead(leadId: string): Promise<void> {
  if (!mailConfigured()) return;
  const lead = await db.lead.findUnique({ where: { id: leadId } });
  if (!lead) return;
  const to = (process.env.LEADS_NOTIFY_EMAIL ?? "").split(/[,;\s]+/).filter((e) => e.includes("@"));
  if (!to.length) to.push(...(await db.user.findMany({ where: { role: { in: ["ADMIN", "EDITOR"] } }, select: { email: true } })).map((u) => u.email));
  const base = (process.env.SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "")).replace(/\/$/, "");
  const link = `${base}/admin/leads/${lead.id}`;
  const rows: [string, string][] = [
    ["Vardas", lead.name],
    ["El. paštas", lead.email ?? ""],
    ["Telefonas", lead.phone ?? ""],
    ["Įmonė", lead.company ?? ""],
    ["Produktas", lead.productSku ?? ""],
  ].filter((r): r is [string, string] => Boolean(r[1]));
  const text = `Nauja užklausa svetainėje\n\n${rows.map(([k, v]) => `${k}: ${v}`).join("\n")}\n\n${lead.message}\n\nAtidaryti: ${link}`;
  const html = `<div style="font-family:Arial,sans-serif;color:#262626;max-width:560px">
<p style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#c30a1e;margin:0 0 8px">Simetria · nauja užklausa</p>
<h2 style="font-weight:400;margin:0 0 16px">${esc(lead.name)}</h2>
<table style="font-size:14px;border-collapse:collapse">${rows.map(([k, v]) => `<tr><td style="padding:4px 16px 4px 0;color:#898989">${k}</td><td style="padding:4px 0">${esc(v)}</td></tr>`).join("")}</table>
<p style="font-size:15px;line-height:1.5;white-space:pre-line;border-left:3px solid #c30a1e;padding-left:12px;margin:16px 0">${esc(lead.message)}</p>
<p><a href="${link}" style="display:inline-block;background:#262626;color:#fff;text-decoration:none;padding:10px 18px;border-radius:999px;font-size:14px">Atidaryti administravime</a></p>
</div>`;
  for (const addr of [...new Set(to)]) {
    await sendMail({ to: addr, subject: `Nauja užklausa: ${lead.name}${lead.productSku ? ` (${lead.productSku})` : ""}`, html, text });
  }
}
