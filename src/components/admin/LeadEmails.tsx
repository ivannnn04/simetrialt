"use client";

import { useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { refreshLeadMail, sendLeadEmail } from "@/actions/lead-mail";
import { cn } from "@/lib/cn";

export type MailView = {
  id: string;
  direction: "IN" | "OUT";
  from: string;
  to: string;
  date: string;
  subject: string;
  main: string;
  quoted: string;
  unread: boolean;
  mailbox: string;
};
export type ThreadView = {
  key: string;
  subject: string;
  messages: MailView[];
  reply: { id: string; to: string; subject: string; mailboxId: string };
};
type MailboxOption = { id: string; label: string };

/** "Laiškai" on a lead: conversations with the client from the connected Gmail mailboxes, and the reply box. */
export function LeadEmails({
  leadId,
  leadEmail,
  threads,
  mailboxes,
  defaultMailboxId,
  isAdmin,
}: {
  leadId: string;
  leadEmail: string;
  threads: ThreadView[];
  mailboxes: MailboxOption[];
  defaultMailboxId: string;
  isAdmin: boolean;
}) {
  const [busy, start] = useTransition();
  const [refreshMsg, setRefreshMsg] = useState<{ ok?: string; error?: string } | null>(null);
  const [composeNew, setComposeNew] = useState(threads.length === 0 && Boolean(leadEmail));
  const [openReply, setOpenReply] = useState<string | null>(threads[0]?.key ?? null);
  const count = threads.reduce((n, t) => n + t.messages.length, 0);

  return (
    <section className="rounded-xl bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-zinc-500">
          Laiškai {count > 0 && <span className="ml-1 rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">{count}</span>}
        </h2>
        {mailboxes.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                start(async () => {
                  setRefreshMsg(null);
                  setRefreshMsg(await refreshLeadMail(leadId));
                })
              }
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs hover:bg-zinc-50 disabled:opacity-50"
            >
              {busy ? "Tikrinama…" : "Tikrinti naujus laiškus"}
            </button>
            <button type="button" onClick={() => setComposeNew((v) => !v)} className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700">
              Naujas laiškas
            </button>
          </div>
        )}
      </div>
      {refreshMsg && <p className={cn("mb-3 rounded-md px-3 py-2 text-xs", refreshMsg.error ? "bg-red-50 text-red-700" : "bg-zinc-50 text-zinc-600")}>{refreshMsg.error ?? refreshMsg.ok}</p>}

      {mailboxes.length === 0 && (
        <p className="rounded-md bg-zinc-50 p-3 text-sm text-zinc-600">
          Pašto dėžutė neprijungta.{" "}
          {isAdmin ? (
            <Link href="/admin/mailboxes" className="underline">
              Prijunkite Gmail
            </Link>
          ) : (
            "Paprašykite administratoriaus prijungti Gmail"
          )}
          , ir laiškai su šiuo klientu bus rodomi čia.
        </p>
      )}

      {composeNew && mailboxes.length > 0 && (
        <div className="mb-5 rounded-lg border border-zinc-200 p-4">
          <p className="mb-3 text-sm font-medium">Naujas laiškas</p>
          <Composer leadId={leadId} mailboxes={mailboxes} defaultMailboxId={defaultMailboxId} to={leadEmail} subject="" replyToId="" onSent={() => setComposeNew(false)} />
        </div>
      )}

      {threads.length === 0 && mailboxes.length > 0 && !composeNew && (
        <p className="text-sm text-zinc-500">{leadEmail ? "Laiškų su šiuo klientu dar nėra." : "Klientas neturi el. pašto adreso."}</p>
      )}

      <div className="space-y-6">
        {threads.map((t) => (
          <div key={t.key} className="rounded-lg border border-zinc-200">
            <div className="flex items-center justify-between gap-2 border-b border-zinc-100 px-4 py-2.5">
              <p className="min-w-0 truncate text-sm font-medium" title={t.subject}>
                {t.subject || "(be temos)"}
              </p>
              <span className="shrink-0 text-xs text-zinc-400">{t.messages.length} laišk.</span>
            </div>
            <div className="space-y-3 bg-zinc-50/60 p-4">
              {t.messages.map((m) => (
                <Bubble key={m.id} m={m} />
              ))}
            </div>
            {mailboxes.length > 0 && (
              <div className="border-t border-zinc-100 p-4">
                {openReply === t.key ? (
                  <Composer
                    leadId={leadId}
                    mailboxes={mailboxes}
                    defaultMailboxId={mailboxes.some((b) => b.id === defaultMailboxId) ? defaultMailboxId : t.reply.mailboxId}
                    to={t.reply.to}
                    subject={t.reply.subject}
                    replyToId={t.reply.id}
                  />
                ) : (
                  <button type="button" onClick={() => setOpenReply(t.key)} className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-white">
                    Atsakyti
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function Bubble({ m }: { m: MailView }) {
  const out = m.direction === "OUT";
  return (
    <div className={cn("flex", out ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "w-full max-w-[92%] rounded-xl px-4 py-3 text-sm shadow-sm sm:max-w-[85%]",
          out ? "bg-zinc-900 text-zinc-50" : "bg-white ring-1 ring-zinc-200",
          m.unread && "ring-2 ring-[#c30a1e]"
        )}
      >
        <div className={cn("flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-xs", out ? "text-zinc-400" : "text-zinc-500")}>
          <span className={cn("font-medium", out ? "text-zinc-100" : "text-zinc-800")}>
            {m.unread && <span className="mr-1.5 rounded-full bg-[#c30a1e] px-1.5 py-0.5 text-[10px] font-semibold text-white">Naujas</span>}
            {m.from}
          </span>
          <span>{m.date}</span>
        </div>
        <p className={cn("mt-0.5 text-[11px]", out ? "text-zinc-400" : "text-zinc-400")}>
          kam: {m.to}
          {m.mailbox && ` · per ${m.mailbox}`}
        </p>
        {m.subject && <p className="mt-1 text-xs font-medium">{m.subject}</p>}
        <p className="mt-2 whitespace-pre-wrap break-words leading-relaxed">{m.main || <span className="italic opacity-60">(tuščias laiškas)</span>}</p>
        {m.quoted && (
          <details className="mt-2">
            <summary className={cn("cursor-pointer select-none text-xs", out ? "text-zinc-400" : "text-zinc-500")}>Rodyti cituojamą tekstą</summary>
            <p className={cn("mt-2 whitespace-pre-wrap break-words border-l-2 pl-3 text-xs leading-relaxed", out ? "border-zinc-600 text-zinc-300" : "border-zinc-200 text-zinc-500")}>{m.quoted}</p>
          </details>
        )}
      </div>
    </div>
  );
}

function Composer({
  leadId,
  mailboxes,
  defaultMailboxId,
  to,
  subject,
  replyToId,
  onSent,
}: {
  leadId: string;
  mailboxes: MailboxOption[];
  defaultMailboxId: string;
  to: string;
  subject: string;
  replyToId: string;
  onSent?: () => void;
}) {
  const [state, setState] = useState<{ ok?: string; error?: string }>();
  const [pending, start] = useTransition();
  // no automatic form reset: on an error the typed text stays; it is cleared once the mail is sent
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    start(async () => {
      const r = await sendLeadEmail(undefined, fd);
      setState(r);
      if (r.ok) {
        form.reset();
        onSent?.();
      }
    });
  };
  return (
    <form onSubmit={submit} className="space-y-3 text-sm">
      <input type="hidden" name="leadId" value={leadId} />
      <input type="hidden" name="replyToId" value={replyToId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs text-zinc-500">Siųsti iš</span>
          <select name="mailboxId" defaultValue={defaultMailboxId} className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2">
            {mailboxes.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-zinc-500">Kam</span>
          <input name="to" defaultValue={to} required className="w-full rounded-md border border-zinc-300 px-3 py-2" />
        </label>
      </div>
      <label className="block">
        <span className="mb-1 block text-xs text-zinc-500">Tema</span>
        <input name="subject" defaultValue={subject} required className="w-full rounded-md border border-zinc-300 px-3 py-2" />
      </label>
      <textarea name="text" required rows={6} placeholder={replyToId ? "Jūsų atsakymas…" : "Laiško tekstas…"} className="w-full rounded-md border border-zinc-300 px-3 py-2 leading-relaxed" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        {replyToId ? (
          <label className="flex items-center gap-2 text-xs text-zinc-500">
            <input type="checkbox" name="quote" defaultChecked className="h-3.5 w-3.5" />
            Pridėti cituojamą ankstesnį laišką
          </label>
        ) : (
          <span />
        )}
        <button disabled={pending} className="rounded-md bg-zinc-900 px-4 py-2 font-medium text-white hover:bg-zinc-700 disabled:opacity-50">
          {pending ? "Siunčiama…" : "Siųsti"}
        </button>
      </div>
      {state?.error && <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
      {state?.ok && <p className="rounded-md bg-green-50 px-3 py-2 text-xs text-green-800">{state.ok}</p>}
    </form>
  );
}
