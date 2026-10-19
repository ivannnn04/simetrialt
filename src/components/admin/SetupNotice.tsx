import type { DbStatus } from "@/lib/db";

/** Shown instead of the admin while the database or the session secret are not configured. */
export function SetupNotice({ status }: { status: DbStatus }) {
  const checks = [
    { label: "DATABASE_URL (PostgreSQL)", ok: Boolean(process.env.DATABASE_URL) },
    { label: "DIRECT_URL (migracijoms)", ok: Boolean(process.env.DIRECT_URL) },
    { label: "SESSION_SECRET (prisijungimo slapukams)", ok: Boolean(process.env.SESSION_SECRET) },
    { label: "Ryšys su duomenų baze", ok: status.ok },
  ];
  return (
    <div className="mx-auto max-w-xl rounded-xl bg-white p-8 shadow">
      <h1 className="mb-1 text-xl font-semibold">Administravimas dar nesukonfigūruotas</h1>
      <p className="mb-6 text-sm text-zinc-500">
        Administravimui reikia PostgreSQL duomenų bazės. Vieša svetainė veikia iš kode esančio turinio, kol jos nėra.
      </p>
      <ul className="mb-6 space-y-2 text-sm">
        {checks.map((c) => (
          <li key={c.label} className="flex items-center gap-2">
            <span className={c.ok ? "text-green-600" : "text-red-600"}>{c.ok ? "✓" : "✕"}</span>
            {c.label}
          </li>
        ))}
      </ul>
      {status.error && <p className="mb-6 rounded-md bg-red-50 p-3 text-xs text-red-700">{status.error}</p>}
      <ol className="list-decimal space-y-2 pl-5 text-sm text-zinc-700">
        <li>Vercel → Storage → sukurkite Neon Postgres (arba Supabase) ir prijunkite prie projekto.</li>
        <li>
          Settings → Environment Variables: <code>DATABASE_URL</code>, <code>DIRECT_URL</code>, <code>SESSION_SECRET</code>
          (ilgas atsitiktinis tekstas), pasirinktinai <code>SEED_ADMIN_EMAIL</code> ir <code>SEED_ADMIN_PASSWORD</code>.
        </li>
        <li>Redeploy – diegimas pats sukurs lenteles ir administratorių (numatytasis: admin@simetria.lt / Simetria-2026!).</li>
      </ol>
    </div>
  );
}
