"use client";

import { useState, useTransition } from "react";
import { rehostProjectPhotos } from "@/actions/legacy-projects";
import { SecondaryButton } from "@/components/admin/ui";

/** Repeats the copy round until every project photo lives in the website's own storage. */
export function RehostPhotos({ external }: { external: number }) {
  const [busy, start] = useTransition();
  const [status, setStatus] = useState("");
  const run = () =>
    start(async () => {
      let moved = 0;
      for (let round = 0; round < 100; round++) {
        const r = await rehostProjectPhotos();
        moved += r.moved;
        setStatus(`Perkelta: ${moved}. Liko: ${r.remaining}.${r.errors.length ? ` Klaidų: ${r.errors.length} (pvz. ${r.errors[0]})` : ""}`);
        if (r.error || r.remaining === 0 || r.moved === 0) {
          if (r.error) setStatus((s) => `${s} Sustabdyta: ${r.error}`);
          break;
        }
      }
    });
  return (
    <div className="space-y-2">
      <SecondaryButton type="button" disabled={busy || external === 0} onClick={run}>
        {busy ? "Perkeliama…" : `Perkelti nuotraukas į svetainės saugyklą (${external})`}
      </SecondaryButton>
      {status && <p className="text-sm text-zinc-600">{status}</p>}
    </div>
  );
}
