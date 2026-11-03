"use client";

import { useState, useTransition, type FormEvent } from "react";
import { addMailbox, changeMailboxPassword, deleteMailbox, setAutoCreateLeads, setMailboxActive, setMailboxOwner, syncMailboxNow } from "@/actions/mailboxes";
import { Badge, Card, Field, Input, Notice, PrimaryButton, SecondaryButton, Select } from "@/components/admin/ui";

type Box = {
  id: string;
  email: string;
  displayName: string;
  hosts: string;
  ownerUserId: string;
  lastSyncAt: string | null;
  lastError: string | null;
  active: boolean;
  syncing: boolean;
  messages: number;
};
type User = { id: string; name: string; email: string };
type Msg = { ok?: string; error?: string };

/**
 * Submits a form to a server action without React's automatic form reset, so what was typed stays
 * when the action answers with an error; the form is cleared only on success.
 */
function useSubmit(fn: (fd: FormData) => Promise<Msg>) {
  const [state, setState] = useState<Msg | undefined>();
  const [pending, start] = useTransition();
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    start(async () => {
      const r = await fn(fd);
      setState(r);
      if (r.ok) form.reset();
    });
  };
  return [state, onSubmit, pending] as const;
}

export function MailboxesPanel({ boxes, users, autoCreate }: { boxes: Box[]; users: User[]; autoCreate: boolean }) {
  const [added, add, adding] = useSubmit((fd) => addMailbox(undefined, fd));
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<{ id?: string; ok?: string; error?: string } | null>(null);
  const [advanced, setAdvanced] = useState(false);

  const sync = (id?: string) =>
    start(async () => {
      setMsg(null);
      setMsg({ id, ...(await syncMailboxNow(id)) });
    });

  return (
    <div className="space-y-6">
      <Card title="Prijungtos dėžutės">
        {boxes.length === 0 && <p className="text-sm text-zinc-500">Dar neprijungta nė viena dėžutė.</p>}
        <ul className="divide-y divide-zinc-100">
          {boxes.map((b) => (
            <li key={b.id} className="py-4 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">
                    {b.email} {b.displayName && <span className="font-normal text-zinc-500">· {b.displayName}</span>}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                    {b.active ? <Badge tone="green">Aktyvi</Badge> : <Badge>Išjungta</Badge>}
                    {b.syncing && <Badge tone="blue">Sinchronizuojama…</Badge>}
                    <span>Paskutinė sinchronizacija: {b.lastSyncAt ?? "dar nebuvo"}</span>
                    <span>· laiškų CRM: {b.messages}</span>
                    {b.hosts && <span>· {b.hosts}</span>}
                  </div>
                  {b.lastError && <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{b.lastError}</p>}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <SecondaryButton type="button" disabled={busy || !b.active} onClick={() => sync(b.id)} className="px-3 py-1.5">
                    Sinchronizuoti dabar
                  </SecondaryButton>
                  <SecondaryButton type="button" disabled={busy} onClick={() => start(() => setMailboxActive(b.id, !b.active))} className="px-3 py-1.5">
                    {b.active ? "Išjungti" : "Įjungti"}
                  </SecondaryButton>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      if (confirm(`Ištrinti ${b.email}? Bus pašalintas užšifruotas slaptažodis ir iš šios dėžutės nukopijuoti laiškai CRM (Gmail laiškai nepaliečiami).`)) start(() => deleteMailbox(b.id));
                    }}
                    className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    Ištrinti
                  </button>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-end gap-4 text-sm">
                <label className="flex items-center gap-2 text-zinc-600">
                  Savininkas
                  <select
                    defaultValue={b.ownerUserId}
                    onChange={(e) => start(() => setMailboxOwner(b.id, e.target.value))}
                    className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm"
                  >
                    <option value="">— bendra —</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name || u.email}
                      </option>
                    ))}
                  </select>
                </label>
                <PasswordChange id={b.id} />
              </div>
              {msg?.id === b.id && (msg.ok || msg.error) && (
                <p className={`mt-2 whitespace-pre-line rounded-md px-3 py-2 text-xs ${msg.error ? "bg-red-50 text-red-700" : "bg-green-50 text-green-800"}`}>{msg.error ?? msg.ok}</p>
              )}
            </li>
          ))}
        </ul>
        {boxes.length > 1 && (
          <div className="mt-4 border-t border-zinc-100 pt-4">
            <SecondaryButton type="button" disabled={busy} onClick={() => sync()}>
              {busy ? "Sinchronizuojama…" : "Sinchronizuoti visas"}
            </SecondaryButton>
            {msg && !msg.id && (msg.ok || msg.error) && (
              <p className={`mt-2 whitespace-pre-line rounded-md px-3 py-2 text-xs ${msg.error ? "bg-red-50 text-red-700" : "bg-green-50 text-green-800"}`}>{msg.error ?? msg.ok}</p>
            )}
          </div>
        )}
      </Card>

      <Card title="Nustatymai">
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" defaultChecked={autoCreate} onChange={(e) => start(() => setAutoCreateLeads(e.target.checked))} className="mt-0.5 h-4 w-4" />
          <span>
            <span className="font-medium">Naujas laiškas iš nežinomo siuntėjo sukuria užklausą</span>
            <span className="block text-xs text-zinc-500">
              Išjungta – saugomi tik laiškai su esamais klientais. Įjungta – naujas laiškas INBOX iš adreso, kurio nėra CRM, sukuria užklausą (šaltinis „email“).
              Naujienlaiškiai, automatiniai atsakymai ir „no-reply“ siuntėjai praleidžiami; senesni (pirmojo sinchronizavimo) laiškai užklausų nekuria.
            </span>
          </span>
        </label>
      </Card>

      <Card title="Prijungti Gmail dėžutę">
        <div className="mb-4 rounded-md bg-zinc-50 p-4 text-sm text-zinc-700">
          <p className="font-medium">Kaip gauti programos slaptažodį</p>
          <ol className="mt-1 list-decimal space-y-1 pl-5">
            <li>
              Prisijunkite prie tos Google paskyros ir įjunkite <b>patvirtinimą dviem veiksmais</b> (myaccount.google.com → Sauga → Patvirtinimas dviem veiksmais).
            </li>
            <li>
              Atidarykite{" "}
              <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" className="underline">
                myaccount.google.com/apppasswords
              </a>
              , įveskite pavadinimą (pvz. „Simetria CRM“) ir spauskite „Sukurti“.
            </li>
            <li>Nukopijuokite 16 raidžių slaptažodį ir įklijuokite žemiau (tarpai nesvarbūs). Jis saugomas užšifruotas ir daugiau nerodomas.</li>
          </ol>
          <p className="mt-2 text-xs text-zinc-500">Google Workspace paskyroje administratorius turi leisti programų slaptažodžius ir IMAP. Atšaukus slaptažodį Google paskyroje ryšys nutrūksta.</p>
        </div>
        <form onSubmit={add} className="grid gap-4 sm:grid-cols-2">
          <Field label="El. pašto adresas">
            <Input name="email" type="email" required placeholder="vardas@simetria.lt" autoComplete="off" />
          </Field>
          <Field label="Siuntėjo vardas" hint="Rodomas klientui, pvz. „Simetria – Jonas“">
            <Input name="displayName" placeholder="Simetria" />
          </Field>
          <Field label="Programos slaptažodis">
            <Input name="password" type="password" required placeholder="xxxx xxxx xxxx xxxx" autoComplete="new-password" />
          </Field>
          <Field label="Savininkas" hint="Jo atsakymai pagal nutylėjimą siunčiami iš šios dėžutės">
            <Select name="ownerUserId" defaultValue="">
              <option value="">— bendra —</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name || u.email}
                </option>
              ))}
            </Select>
          </Field>
          {advanced ? (
            <>
              <Field label="IMAP serveris" hint="Gmail: imap.gmail.com">
                <Input name="imapHost" defaultValue="imap.gmail.com" />
              </Field>
              <Field label="SMTP serveris" hint="Gmail: smtp.gmail.com">
                <Input name="smtpHost" defaultValue="smtp.gmail.com" />
              </Field>
            </>
          ) : (
            <button type="button" onClick={() => setAdvanced(true)} className="justify-self-start text-xs text-zinc-500 underline sm:col-span-2">
              Kiti serveriai (nebūtina)
            </button>
          )}
          <div className="space-y-3 sm:col-span-2">
            <PrimaryButton disabled={adding}>{adding ? "Tikrinamas ryšys…" : "Patikrinti ir prijungti"}</PrimaryButton>
            {added?.error && <Notice tone="red">{added.error}</Notice>}
            {added?.ok && <Notice tone="green">{added.ok}</Notice>}
          </div>
        </form>
      </Card>
    </div>
  );
}

function PasswordChange({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useSubmit((fd) => changeMailboxPassword(id, undefined, fd));
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-xs text-zinc-500 underline">
        Pakeisti programos slaptažodį
      </button>
    );
  return (
    <form onSubmit={action} className="flex flex-wrap items-center gap-2">
      <input name="password" type="password" required placeholder="Naujas programos slaptažodis" autoComplete="new-password" className="rounded-md border border-zinc-300 px-2 py-1 text-sm" />
      <SecondaryButton disabled={pending} className="px-3 py-1">
        {pending ? "Tikrinama…" : "Išsaugoti"}
      </SecondaryButton>
      {state?.error && <span className="text-xs text-red-600">{state.error}</span>}
      {state?.ok && <span className="text-xs text-green-700">{state.ok}</span>}
    </form>
  );
}
