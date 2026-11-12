"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { storeExternalPhotos } from "@/actions/products";

/** Copies photos still linked from other websites into our storage, in rounds, until none are left. */
export function ExternalPhotosButton({ count }: { count: number }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  if (count === 0 && !msg) return null;
  const run = async () => {
    setRunning(true);
    let total = 0;
    const failed: string[] = [];
    try {
      for (;;) {
        const r = await storeExternalPhotos();
        total += r.stored;
        failed.push(...r.failed);
        setMsg(`Perkelta ${total}, liko ${r.remaining}…`);
        if (r.remaining === 0 || r.stored === 0) {
          setMsg(`Perkelta nuotraukų: ${total}.${r.remaining ? ` Nepavyko: ${r.remaining}.` : ""}${failed.length ? ` ${failed.slice(0, 3).join("; ")}` : ""}`);
          break;
        }
      }
    } catch (e) {
      setMsg(`Sustabdyta: ${e instanceof Error ? e.message : "klaida"}. Spauskite dar kartą – tęsiama nuo ten, kur sustojo.`);
    } finally {
      setRunning(false);
      router.refresh();
    }
  };
  return (
    <span className="flex items-center gap-3">
      <button
        type="button"
        disabled={running}
        onClick={run}
        className="rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900 hover:bg-amber-100 disabled:opacity-50"
        title="Nuotraukos, kurios vis dar rodomos iš tiekėjo svetainės, nukopijuojamos į mūsų saugyklą"
      >
        {running ? "Perkeliama…" : `Perkelti išorines nuotraukas (${count})`}
      </button>
      {msg && <span className="text-xs text-zinc-500">{msg}</span>}
    </span>
  );
}
