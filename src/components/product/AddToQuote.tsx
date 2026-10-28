"use client";

import { useState, useTransition } from "react";
import { addProductToMyQuote } from "@/actions/quotes";

/** Shown to signed-in staff on a product page: puts the selected variant into their open quote. */
export function AddToQuote({ productId }: { productId: string }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ quoteId?: string; error?: string } | null>(null);
  return (
    <div className="mt-4 flex flex-wrap items-center gap-3 rounded-md border border-dashed border-zinc-400 px-4 py-3 text-[13px]">
      <span className="text-secondary">Salonas:</span>
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => setResult(await addProductToMyQuote(productId)))}
        className="rounded-md bg-black px-3 py-1.5 text-white disabled:opacity-50"
      >
        {pending ? "Pridedama…" : "Į pasiūlymą"}
      </button>
      {result?.quoteId && (
        <a href={`/admin/quotes/${result.quoteId}`} target="_blank" className="underline">
          Pridėta – atidaryti pasiūlymą ↗
        </a>
      )}
      {result?.error && <span className="text-red-600">{result.error}</span>}
    </div>
  );
}
