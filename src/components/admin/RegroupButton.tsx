"use client";

import { useState, useTransition } from "react";
import { regroupProducts } from "@/actions/products";

/** One click: recompute which products are variants of one design, for the whole catalogue. */
export function RegroupButton() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <span className="flex items-center gap-3">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await regroupProducts();
            setMsg(`Sugrupuota: ${r.products} produktai → ${r.groups} kortelės.`);
          })
        }
        className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm hover:bg-zinc-50 disabled:opacity-50"
        title="Tos pačios prekės spalvų / apdailos variantai sujungiami į vieną kortelę su pasirinkimais"
      >
        {pending ? "Grupuojama…" : "Pergrupuoti variantus"}
      </button>
      {msg && <span className="text-xs text-zinc-500">{msg}</span>}
    </span>
  );
}
