"use client";

import { useActionState, useState, useTransition } from "react";
import { pullScoroPrices, registerScoroWebhooks, saveScoroSettings, syncScoroNow, testScoro } from "@/actions/scoro";
import { Card, Field, Input, Notice, PrimaryButton, SecondaryButton } from "@/components/admin/ui";

type Settings = {
  subdomain: string;
  companyAccountId: string;
  hasKey: boolean;
  lang: string;
  priceListId: string;
  domainToken: string;
  pushProducts: boolean;
  overwriteExisting: boolean;
  pushLeads: boolean;
  pushQuotes: boolean;
  pullQuotes: boolean;
  enrichQuotes: boolean;
  pullPrices: boolean;
};

const SWITCHES: { key: keyof Settings; label: string; hint: string }[] = [
  { key: "pushProducts", label: "Svetainės produktai → Scoro", hint: "Nauji produktai sukuriami Scoro. Jei Scoro jau yra produktas su tuo pačiu kodu, jam pridedama tik nuoroda į svetainę ir nuotraukų nuorodos." },
  { key: "overwriteExisting", label: "Perrašyti esamų Scoro produktų pavadinimą, aprašymą ir kainą", hint: "Išjungta – esami Scoro produktai lieka nepakeisti (tik nuoroda ir nuotraukos)." },
  { key: "pushLeads", label: "Svetainės užklausos → Scoro", hint: "Kontaktas (randamas pagal el. paštą arba sukuriamas) ir pasiūlymas su produktu, apie kurį klausta." },
  { key: "pushQuotes", label: "Admin pasiūlymai → Scoro", hint: "Išsaugotas pasiūlymas sukuriamas Scoro, vėliau atnaujinamas." },
  { key: "pullQuotes", label: "Scoro pasiūlymai → svetainės admin", hint: "Reikia užregistruoti webhook (mygtukas žemiau)." },
  { key: "enrichQuotes", label: "Pildyti Scoro pasiūlymų eilučių nuotraukas iš svetainės", hint: "Kai Scoro pasiūlymas išsaugomas, tuščias nuotraukų laukas užpildomas svetainės nuotraukomis. Kitos eilučių reikšmės nekeičiamos." },
  { key: "pullPrices", label: "Scoro kainos → svetainė", hint: "Kartą per parą (ir mygtuku) pakeistos Scoro kainos perrašo svetainės kainas (+ PVM)." },
];

export function ScoroPanel({ settings, webhookUrl, domainUrl }: { settings: Settings; webhookUrl: string; domainUrl: string }) {
  const [saved, save, saving] = useActionState(saveScoroSettings, undefined);
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<{ ok?: string; error?: string } | null>(null);
  const [progress, setProgress] = useState("");

  const run = (fn: () => Promise<{ ok?: string; error?: string }>) =>
    start(async () => {
      setMsg(null);
      setMsg(await fn());
    });

  const syncAll = () =>
    start(async () => {
      setMsg(null);
      let total = 0;
      for (let round = 0; round < 200; round++) {
        const r = await syncScoroNow();
        if (r.error) return setMsg({ error: r.error });
        total += r.products + r.tasks;
        setProgress(`Išsiųsta: ${total}. Laukia: ${r.pendingProducts} produktų, ${r.pendingTasks} užduočių.${r.failed ? ` Klaidų: ${r.failed}.` : ""}`);
        // stop when nothing waits, or when a round made no progress (only failures left)
        if ((r.pendingProducts === 0 && r.pendingTasks === 0) || r.checked + r.tasks === 0) break;
      }
      setMsg({ ok: "Sinchronizavimas baigtas." });
    });

  return (
    <div className="space-y-6">
      <Card title="Prisijungimas">
        <form action={save} className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Scoro adresas" hint="Pvz. simetria (iš https://simetria.scoro.com)">
              <Input name="subdomain" defaultValue={settings.subdomain} placeholder="simetria" />
            </Field>
            <Field label="company_account_id" hint="Scoro: Nustatymai → Integracija → Scoro API">
              <Input name="companyAccountId" defaultValue={settings.companyAccountId} placeholder="simetria" />
            </Field>
            <Field label="API raktas" hint={settings.hasKey ? "Raktas išsaugotas. Palikite tuščią, kad nepasikeistų." : "ScoroAPI_…"}>
              <Input name="apiKey" type="password" autoComplete="off" placeholder={settings.hasKey ? "••••••••••" : ""} />
            </Field>
            <Field label="Kalba (Scoro kodas)" hint="eng arba lit – kuria kalba rašomi pavadinimai ir aprašymai">
              <Input name="lang" defaultValue={settings.lang} />
            </Field>
            <Field label="Kainoraščio ID (nebūtina)" hint="Tuščia – numatytasis Scoro kainoraštis">
              <Input name="priceListId" defaultValue={settings.priceListId} />
            </Field>
            <Field label="scoro.txt turinys (nebūtina)" hint={`Scoro tikrina ${domainUrl} prieš priimdamas webhook`}>
              <Input name="domainToken" defaultValue={settings.domainToken} />
            </Field>
          </div>
          <div className="space-y-3 border-t border-zinc-100 pt-4">
            <p className="text-sm font-medium">Kas sinchronizuojama (viskas išjungta, kol neįjungsite)</p>
            {SWITCHES.map((s) => (
              <label key={s.key} className="flex items-start gap-3 text-sm">
                <input type="checkbox" name={s.key} defaultChecked={Boolean(settings[s.key])} className="mt-1" />
                <span>
                  <span className="font-medium">{s.label}</span>
                  <span className="block text-xs text-zinc-500">{s.hint}</span>
                </span>
              </label>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <PrimaryButton disabled={saving}>{saving ? "Saugoma…" : "Išsaugoti"}</PrimaryButton>
            {saved?.ok && <span className="text-sm text-green-700">{saved.ok}</span>}
            {saved?.error && <span className="text-sm text-red-600">{saved.error}</span>}
          </div>
        </form>
      </Card>

      <Card title="Veiksmai">
        <div className="flex flex-wrap gap-2">
          <SecondaryButton type="button" disabled={busy} onClick={() => run(testScoro)}>Patikrinti ryšį</SecondaryButton>
          <PrimaryButton type="button" disabled={busy} onClick={syncAll}>Sinchronizuoti dabar</PrimaryButton>
          <SecondaryButton type="button" disabled={busy} onClick={() => run(registerScoroWebhooks)}>Užregistruoti webhook Scoro</SecondaryButton>
          <SecondaryButton type="button" disabled={busy} onClick={() => run(pullScoroPrices)}>Atsisiųsti kainas iš Scoro</SecondaryButton>
        </div>
        {busy && <p className="mt-3 text-sm text-zinc-500">Vykdoma…</p>}
        {progress && <p className="mt-3 text-sm text-zinc-600">{progress}</p>}
        {msg?.ok && <div className="mt-3"><Notice tone="green">{msg.ok}</Notice></div>}
        {msg?.error && <div className="mt-3"><Notice tone="red">{msg.error}</Notice></div>}
        <p className="mt-4 text-xs text-zinc-500">
          Webhook adresas: <code className="break-all">{webhookUrl}</code>
        </p>
      </Card>
    </div>
  );
}
