"use client";

import { useActionState } from "react";
import { saveSiteImage, type SlotResult } from "@/actions/site-images";

/** One photo slot: preview, upload a file or paste an image address. */
export function SiteImageSlot({ path, label, current }: { path: string; label: string; current: string | null }) {
  const [state, action, pending] = useActionState<SlotResult | undefined, FormData>(saveSiteImage.bind(null, path), undefined);
  return (
    <form action={action} data-slot={path} className="flex gap-3 rounded-lg border border-zinc-200 bg-white p-3">
      <div className="h-20 w-28 shrink-0 overflow-hidden rounded bg-zinc-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {current ? <img src={current} alt="" className="size-full object-cover" /> : <span className="flex size-full items-center justify-center text-[10px] text-zinc-400">laikina</span>}
      </div>
      <div className="min-w-0 flex-1 space-y-1.5">
        <p className="text-sm font-medium">{label}</p>
        <p className="truncate font-mono text-[11px] text-zinc-400">/images/{path}</p>
        <div className="flex flex-wrap items-center gap-2">
          <input type="file" name="file" accept="image/*" className="max-w-[180px] text-xs" />
          <input name="url" placeholder="arba nuoroda į nuotrauką" className="min-w-0 flex-1 rounded border border-zinc-300 px-2 py-1 text-xs" />
          <button disabled={pending} className="rounded bg-zinc-900 px-2.5 py-1 text-xs text-white disabled:opacity-50">{pending ? "…" : "Įkelti"}</button>
        </div>
        {state?.ok && <p className="text-xs text-green-700" data-status="ok">{state.ok}</p>}
        {state?.error && <p className="text-xs text-red-600" data-status="error">{state.error}</p>}
      </div>
    </form>
  );
}
