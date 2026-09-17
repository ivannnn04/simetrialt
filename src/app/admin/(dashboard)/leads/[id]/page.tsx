import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { addLeadNote, deleteLead, updateLeadStatus } from "@/actions/leads";

const STATUS_LABELS: Record<string, string> = {
  NEW: "Nauja",
  CONTACTED: "Susisiekta",
  QUALIFIED: "Kvalifikuota",
  WON: "Laimėta",
  LOST: "Prarasta",
};

export default async function LeadDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const lead = await db.lead.findUnique({
    where: { id },
    include: { notes: { orderBy: { createdAt: "desc" } } },
  });
  if (!lead) notFound();

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{lead.name}</h1>
          {lead.company && <p className="text-zinc-500">{lead.company}</p>}
        </div>
        <form action={deleteLead.bind(null, lead.id)}>
          <button className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50">
            Ištrinti
          </button>
        </form>
      </div>

      <div className="rounded-xl bg-white p-5 shadow-sm text-sm">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
          <div>
            <dt className="text-zinc-500">El. paštas</dt>
            <dd>{lead.email ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Telefonas</dt>
            <dd>{lead.phone ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Šaltinis</dt>
            <dd>{lead.source}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Gauta</dt>
            <dd>{lead.createdAt.toLocaleString("lt-LT")}</dd>
          </div>
        </dl>
        {lead.message && (
          <div className="mt-4 rounded-md bg-zinc-50 p-3">
            <p className="whitespace-pre-wrap">{lead.message}</p>
          </div>
        )}
      </div>

      <div className="rounded-xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-medium text-zinc-500">Būsena</h2>
        <div className="flex flex-wrap gap-2">
          {Object.entries(STATUS_LABELS).map(([key, label]) => (
            <form key={key} action={updateLeadStatus.bind(null, lead.id, key)}>
              <button
                className={`rounded-full px-3 py-1 text-sm ${
                  lead.status === key
                    ? "bg-zinc-900 text-white"
                    : "bg-zinc-100 hover:bg-zinc-200"
                }`}
              >
                {label}
              </button>
            </form>
          ))}
        </div>
      </div>

      <div className="rounded-xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-medium text-zinc-500">Pastabos</h2>
        <form action={addLeadNote.bind(null, lead.id)} className="mb-4 flex gap-2">
          <input
            name="body"
            placeholder="Nauja pastaba…"
            required
            className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
          <button className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700">
            Pridėti
          </button>
        </form>
        <ul className="space-y-3">
          {lead.notes.map((note) => (
            <li key={note.id} className="rounded-md bg-zinc-50 p-3 text-sm">
              <p className="whitespace-pre-wrap">{note.body}</p>
              <p className="mt-1 text-xs text-zinc-400">{note.createdAt.toLocaleString("lt-LT")}</p>
            </li>
          ))}
          {lead.notes.length === 0 && <p className="text-sm text-zinc-500">Pastabų nėra.</p>}
        </ul>
      </div>
    </div>
  );
}
