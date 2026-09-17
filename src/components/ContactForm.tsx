"use client";

import { useActionState } from "react";
import { submitContact } from "@/actions/leads";

export function ContactForm({ initialMessage }: { initialMessage?: string }) {
  const [state, formAction, pending] = useActionState(submitContact, undefined);
  if (state?.message) {
    return (
      <div className="rounded-xl bg-green-50 p-6 text-green-800">
        {state.message}
      </div>
    );
  }
  return (
    <form action={formAction} className="max-w-lg space-y-4">
      {/* Honeypot — hidden from humans */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      <div>
        <label className="mb-1 block text-sm font-medium">Vardas *</label>
        <input name="name" required className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium">El. paštas</label>
          <input name="email" type="email" className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Telefonas</label>
          <input name="phone" className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm" />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Įmonė</label>
        <input name="company" className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Žinutė *</label>
        <textarea
          name="message"
          required
          rows={5}
          defaultValue={initialMessage}
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
        />
      </div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        disabled={pending}
        className="rounded-md bg-zinc-900 px-6 py-3 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
      >
        {pending ? "Siunčiama…" : "Siųsti užklausą"}
      </button>
    </form>
  );
}
