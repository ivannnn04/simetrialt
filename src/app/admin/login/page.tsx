"use client";

import { useActionState } from "react";
import { loginAction } from "@/actions/auth";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, undefined);
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-100 px-4">
      <form
        action={formAction}
        className="w-full max-w-sm rounded-xl bg-white p-8 shadow"
      >
        <h1 className="mb-1 text-xl font-semibold">Simetria LT</h1>
        <p className="mb-6 text-sm text-zinc-500">Administratoriaus prisijungimas</p>
        <label className="mb-1 block text-sm font-medium">El. paštas</label>
        <input
          name="email"
          type="email"
          required
          className="mb-4 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
        <label className="mb-1 block text-sm font-medium">Slaptažodis</label>
        <input
          name="password"
          type="password"
          required
          className="mb-4 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
        {state?.error && (
          <p className="mb-4 text-sm text-red-600">{state.error}</p>
        )}
        <button
          disabled={pending}
          className="w-full rounded-md bg-zinc-900 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
        >
          {pending ? "Jungiamasi…" : "Prisijungti"}
        </button>
      </form>
    </main>
  );
}
