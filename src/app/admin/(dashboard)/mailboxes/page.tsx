import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { autoCreateLeads } from "@/lib/mail-sync";
import { MailboxesPanel } from "@/components/admin/MailboxesPanel";
import { PageTitle } from "@/components/admin/ui";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** A run holds the mailbox for at most 3 minutes (a crashed run's lock goes stale). */
const syncingNow = (startedAt: Date | null) => Boolean(startedAt && Date.now() - startedAt.getTime() < 3 * 60_000);

export default async function MailboxesAdmin() {
  await requireAdmin();
  const [boxes, users, autoCreate, counts] = await Promise.all([
    db.mailbox.findMany({
      orderBy: { createdAt: "asc" },
      // the encrypted password never leaves the server
      select: { id: true, email: true, displayName: true, imapHost: true, smtpHost: true, ownerUserId: true, lastSyncAt: true, lastError: true, active: true, syncStartedAt: true },
    }),
    db.user.findMany({ where: { role: { in: ["ADMIN", "EDITOR"] } }, orderBy: { name: "asc" }, select: { id: true, name: true, email: true } }),
    autoCreateLeads(),
    db.emailMessage.groupBy({ by: ["mailboxId"], _count: { _all: true } }),
  ]);
  const fmt = (d: Date | null) => (d ? d.toLocaleString("lt-LT", { timeZone: "Europe/Vilnius" }) : null);
  return (
    <div className="max-w-4xl space-y-6">
      <PageTitle>Pašto dėžutės</PageTitle>
      <p className="max-w-3xl text-sm text-zinc-600">
        Prijunkite Gmail arba Google Workspace adresą: laiškai su CRM klientais (užklausų ir registruotų klientų el. paštais) kas 10 min. nukopijuojami į užklausos kortelę,
        o atsakyti klientui galima tiesiai iš administravimo – klientas gaus įprastą laišką iš to adreso, jis atsiras ir Gmail „Išsiųsti“ aplanke.
      </p>
      <MailboxesPanel
        boxes={boxes.map((b) => ({
          id: b.id,
          email: b.email,
          displayName: b.displayName,
          hosts: b.imapHost === "imap.gmail.com" && b.smtpHost === "smtp.gmail.com" ? "" : `${b.imapHost} / ${b.smtpHost}`,
          ownerUserId: b.ownerUserId ?? "",
          lastSyncAt: fmt(b.lastSyncAt),
          lastError: b.lastError,
          active: b.active,
          syncing: syncingNow(b.syncStartedAt),
          messages: counts.find((c) => c.mailboxId === b.id)?._count._all ?? 0,
        }))}
        users={users}
        autoCreate={autoCreate}
      />
    </div>
  );
}
