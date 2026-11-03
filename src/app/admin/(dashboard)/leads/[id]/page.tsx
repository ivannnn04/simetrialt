import { notFound } from "next/navigation";
import { after } from "next/server";
import { db } from "@/lib/db";
import { requireEditor } from "@/lib/auth";
import { addLeadNote, deleteLead, updateLeadStatus } from "@/actions/leads";
import { loadLeadProducts, parseLeadSections } from "@/lib/lead-items";
import { LeadProducts } from "@/components/admin/LeadProducts";
import { LeadEmails, type ThreadView } from "@/components/admin/LeadEmails";
import { linkOrphanMail, syncMailboxes } from "@/lib/mail-sync";
import { normalizeSubject, replySubject, splitQuoted } from "@/lib/mail-parse";

export const maxDuration = 60;

const when = (d: Date) => d.toLocaleString("lt-LT", { timeZone: "Europe/Vilnius", dateStyle: "short", timeStyle: "short" });

/** E-mails of a lead grouped into conversations (newest conversation first, messages oldest → newest). */
async function loadThreads(leadId: string, leadEmail: string | null) {
  await linkOrphanMail(leadId, leadEmail).catch(() => 0);
  const rows = await db.emailMessage.findMany({
    where: { leadId },
    orderBy: { date: "asc" },
    take: 500,
    include: { mailbox: { select: { email: true } } },
  });
  // viewing the lead reads its mail; the highlight is computed from the state before this visit
  const unread = rows.filter((m) => m.direction === "IN" && !m.readAt).map((m) => m.id);
  if (unread.length) await db.emailMessage.updateMany({ where: { id: { in: unread } }, data: { readAt: new Date() } });
  const groups = new Map<string, typeof rows>();
  for (const m of rows) groups.set(m.threadKey, [...(groups.get(m.threadKey) ?? []), m]);
  const threads: ThreadView[] = [...groups.entries()].map(([key, ms]) => {
    const last = ms[ms.length - 1];
    const lastIn = [...ms].reverse().find((m) => m.direction === "IN");
    return {
      key,
      subject: ms[0].subject,
      messages: ms.map((m) => {
        const { main, quoted } = splitQuoted(m.textBody);
        return {
          id: m.id,
          direction: m.direction === "OUT" ? ("OUT" as const) : ("IN" as const),
          from: m.fromName ? `${m.fromName} <${m.fromAddr}>` : m.fromAddr,
          to: [...m.toAddrs, ...m.ccAddrs].join(", "),
          date: when(m.date),
          // shown only when it differs from the conversation's subject (beyond "Re:")
          subject: normalizeSubject(m.subject) === normalizeSubject(ms[0].subject) ? "" : m.subject,
          main,
          quoted,
          unread: unread.includes(m.id),
          mailbox: m.mailbox.email,
        };
      }),
      reply: {
        id: last.id,
        to: lastIn ? lastIn.fromAddr : last.toAddrs.join(", ") || (leadEmail ?? ""),
        subject: replySubject(last.subject),
        mailboxId: last.mailboxId,
      },
    };
  });
  const lastAt = (t: ThreadView) => rows.find((r) => r.id === t.messages[t.messages.length - 1].id)!.date.getTime();
  return threads.sort((a, b) => lastAt(b) - lastAt(a));
}

const STATUS_LABELS: Record<string, string> = {
  NEW: "Nauja",
  CONTACTED: "Susisiekta",
  QUALIFIED: "Kvalifikuota",
  WON: "Laimėta",
  LOST: "Prarasta",
};

export default async function LeadDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireEditor();
  const { id } = await params;
  const lead = await db.lead.findUnique({
    where: { id },
    include: { notes: { orderBy: { createdAt: "desc" } } },
  });
  if (!lead) notFound();
  const products = await loadLeadProducts(lead.message, lead.productSku);
  const collection = lead.message.match(/^Kolekcija „(.+?)“/)?.[1];
  const structure = products.length ? parseLeadSections(lead.message) : { note: "", sections: [] };
  const [threads, mailboxes] = await Promise.all([
    loadThreads(lead.id, lead.email),
    db.mailbox.findMany({ where: { active: true }, orderBy: { createdAt: "asc" }, select: { id: true, email: true, displayName: true, ownerUserId: true } }),
  ]);
  // fresh mail from Gmail after the page is sent (at most once a minute per mailbox); visible on the next load
  if (mailboxes.length) after(() => syncMailboxes({ budgetMs: 25_000, minIntervalMs: 60_000 }).catch(() => undefined));
  const defaultMailboxId = (mailboxes.find((b) => b.ownerUserId === user.id) ?? mailboxes[0])?.id ?? "";

  return (
    <div className={`${products.length ? "max-w-5xl" : "max-w-3xl"} space-y-6`}>
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{lead.name}</h1>
          {lead.company && <p className="text-zinc-500">{lead.company}</p>}
        </div>
        <form action={deleteLead.bind(null, lead.id)}>
          <button className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50">
            Ištrinti
          </button>
        </form>
      </div>

      <div className="rounded-xl bg-white p-5 shadow-sm text-sm">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
          <div>
            <dt className="text-zinc-500">El. paštas</dt>
            <dd>{lead.email ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Telefonas</dt>
            <dd>{lead.phone ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Šaltinis</dt>
            <dd>{lead.source}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Gauta</dt>
            <dd>{lead.createdAt.toLocaleString("lt-LT")}</dd>
          </div>
        </dl>
        {lead.message && (
          <div className="mt-4 rounded-md bg-zinc-50 p-3">
            <p className="whitespace-pre-wrap">{lead.message}</p>
          </div>
        )}
      </div>

      {products.length > 0 && (
        <LeadProducts
          items={products}
          title={collection ?? `Užklausa – ${lead.name}`}
          customer={{ name: lead.name, email: lead.email ?? "" }}
          sections={structure.sections}
          note={structure.note}
          reference={`SIM-${lead.createdAt.toISOString().slice(2, 10).replace(/-/g, "")}-${lead.id.slice(-4).toUpperCase()}`}
        />
      )}

      <LeadEmails
        leadId={lead.id}
        leadEmail={lead.email ?? ""}
        threads={threads}
        mailboxes={mailboxes.map((b) => ({ id: b.id, label: b.displayName ? `${b.displayName} <${b.email}>` : b.email }))}
        defaultMailboxId={defaultMailboxId}
        isAdmin={user.role === "ADMIN"}
      />

      <div className="rounded-xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-medium text-zinc-500">Būsena</h2>
        <div className="flex flex-wrap gap-2">
          {Object.entries(STATUS_LABELS).map(([key, label]) => (
            <form key={key} action={updateLeadStatus.bind(null, lead.id, key)}>
              <button
                className={`rounded-full px-3 py-1 text-sm ${
                  lead.status === key
                    ? "bg-zinc-900 text-white"
                    : "bg-zinc-100 hover:bg-zinc-200"
                }`}
              >
                {label}
              </button>
            </form>
          ))}
        </div>
      </div>

      <div className="rounded-xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-medium text-zinc-500">Pastabos</h2>
        <form action={addLeadNote.bind(null, lead.id)} className="mb-4 flex gap-2">
          <input
            name="body"
            placeholder="Nauja pastaba…"
            required
            className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
          <button className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700">
            Pridėti
          </button>
        </form>
        <ul className="space-y-3">
          {lead.notes.map((note) => (
            <li key={note.id} className="rounded-md bg-zinc-50 p-3 text-sm">
              <p className="whitespace-pre-wrap">{note.body}</p>
              <p className="mt-1 text-xs text-zinc-400">{note.createdAt.toLocaleString("lt-LT")}</p>
            </li>
          ))}
          {lead.notes.length === 0 && <p className="text-sm text-zinc-500">Pastabų nėra.</p>}
        </ul>
      </div>
    </div>
  );
}
