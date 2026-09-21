"use client";

import { useActionState, useState } from "react";
import { createCollection } from "@/actions/collections";
import { cn } from "@/lib/cn";

export function NewCollectionButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(createCollection, undefined);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={cn("bg-dark px-8 py-[11px] text-center text-[13px] font-medium text-white transition-colors duration-300 hover:bg-accent", className)}>
        New collection
      </button>
    );
  }
  return (
    <form action={action} className={cn("flex items-center gap-2", className)}>
      <input
        autoFocus
        name="name"
        placeholder="Collection name"
        required
        className="h-[38px] min-w-0 flex-1 border border-dark bg-transparent px-3 text-[13px] tracking-[-0.04em] focus:outline-none"
      />
      <button type="submit" disabled={pending} className="bg-dark px-6 py-[11px] text-[13px] font-medium text-white disabled:opacity-50">
        {pending ? "Creating…" : "Create"}
      </button>
      <button type="button" onClick={() => setOpen(false)} className="px-2 text-[13px] text-secondary">Cancel</button>
      {state?.error && <span className="text-[12px] text-[#fb3b30]">{state.error}</span>}
    </form>
  );
}
