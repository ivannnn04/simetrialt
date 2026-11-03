import Link from "next/link";
import { db } from "@/lib/db";
import { requireEditor } from "@/lib/auth";
import { createLead } from "@/actions/leads";
import { parseLeadLines } from "@/lib/lead-items";
import { LeadsBoard, type BoardLead } from "@/components/admin/LeadsBoard";

const STATUS_LABELS: Record<string, string> = {
  NEW: "Nauja",
  CONTACTED: "Susisiekta",
  QUALIFIED: "Kvalifikuota",
  WON: "Laimėta",
  LOST: "Prarasta",
};

const STATUS_COLORS: Record<string, string> = {
  NEW: "bg-blue-100 text-blue-700",
  CONTACTED: "bg-yellow-100 text-yellow-700",
  QUALIFIED: "bg-purple-100 text-purple-700",
  WON: "bg-green-100 text-green-700",
  LOST: "bg-zinc-100 text-zinc-600",
};

export default async function LeadsList({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; view?: string }>;
}) {
  await requireEditor();
  const { status, view } = await searchParams;
  const board = view !== "list";
  const leads = await db.lead.findMany({
    where: status && !board ? { status } : undefined,
    orderBy: { createdAt: "desc" },
    take: board ? 500 : undefined,
  });
  // e-mails per lead (all, and incoming not opened yet) for the card badge
  const [mailCounts, unreadCounts] = await Promise.all([
    db.emailMessage.groupBy({ by: ["leadId"], where: { leadId: { not: null } }, _count: { _all: true } }),
    db.emailMessage.groupBy({ by: ["leadId"], where: { leadId: { not: null }, direction: "IN", readAt: null }, _count: { _all: true } }),
  ]);
  const mails = new Map(mailCounts.map((c) => [c.leadId, c._count._all]));
  const unreadMails = new Map(unreadCounts.map((c) => [c.leadId, c._count._all]));
  const cards: BoardLead[] = board
    ? leads.map((l) => {
        const total = l.message.match(/^Orientacinė suma:\s*([\d\s\u00a0.,]+)/m)?.[1];
        return {
          id: l.id,
          name: l.name,
          company: l.company ?? "",
          contact: [l.email, l.phone].filter(Boolean).join(" · "),
          source: l.source,
          status: l.status,
          date: l.createdAt.toLocaleDateString("lt-LT"),
          preview: l.message.split("\n").find((x) => x.trim())?.trim() ?? "",
          totalCents: total ? Math.round(Number(total.replace(/[\s\u00a0.]/g, "").replace(",", ".")) * 100) || 0 : 0,
          products: parseLeadLines(l.message, l.productSku).length,
          emails: mails.get(l.id) ?? 0,
          unreadEmails: unreadMails.get(l.id) ?? 0,
        };
      })
    : [];
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Užklausos (CRM)</h1>
        <div className="flex rounded-md border border-zinc-300 bg-white p-0.5 text-sm">
          <Link href="/admin/leads" className={`rounded px-3 py-1.5 ${board ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100"}`}>
            Lenta
          </Link>
          <Link href="/admin/leads?view=list" className={`rounded px-3 py-1.5 ${!board ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100"}`}>
            Sąrašas
          </Link>
        </div>
      </div>

      {board ? (
        <LeadsBoard leads={cards} />
      ) : (
      <>
      <div className="flex flex-wrap gap-2 text-sm">
        <Link
          href="/admin/leads?view=list"
          className={`rounded-full px-3 py-1 ${!status ? "bg-zinc-900 text-white" : "bg-white shadow-sm hover:bg-zinc-50"}`}
        >
          Visos
        </Link>
        {Object.entries(STATUS_LABELS).map(([key, label]) => (
          <Link
            key={key}
            href={`/admin/leads?view=list&status=${key}`}
            className={`rounded-full px-3 py-1 ${status === key ? "bg-zinc-900 text-white" : "bg-white shadow-sm hover:bg-zinc-50"}`}
          >
            {label}
          </Link>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-zinc-500">
            <tr>
              <th className="p-4 font-medium">Vardas</th>
              <th className="p-4 font-medium">Kontaktai</th>
              <th className="p-4 font-medium">Šaltinis</th>
              <th className="p-4 font-medium">Būsena</th>
              <th className="p-4 font-medium">Data</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <tr key={lead.id} className="border-t border-zinc-100 hover:bg-zinc-50">
                <td className="p-4">
                  <Link href={`/admin/leads/${lead.id}`} className="font-medium hover:underline">
                    {lead.name}
                  </Link>
                  {lead.company && <span className="ml-2 text-zinc-500">({lead.company})</span>}
                  {(mails.get(lead.id) ?? 0) > 0 && (
                    <span
                      className={`ml-2 rounded-full px-2 py-0.5 text-[11px] ${unreadMails.get(lead.id) ? "bg-[#c30a1e] font-semibold text-white" : "bg-zinc-100 text-zinc-600"}`}
                      title={unreadMails.get(lead.id) ? "Yra neperskaitytų laiškų" : "Laiškai"}
                    >
                      ✉ {unreadMails.get(lead.id) ? `${unreadMails.get(lead.id)} nauj.` : mails.get(lead.id)}
                    </span>
                  )}
                </td>
                <td className="p-4 text-zinc-500">
                  {[lead.email, lead.phone].filter(Boolean).join(" · ") || "—"}
                </td>
                <td className="p-4 text-zinc-500">{lead.source}</td>
                <td className="p-4">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_COLORS[lead.status] ?? ""}`}>
                    {STATUS_LABELS[lead.status] ?? lead.status}
                  </span>
                </td>
                <td className="p-4 text-zinc-500">{lead.createdAt.toLocaleDateString("lt-LT")}</td>
              </tr>
            ))}
            {leads.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-zinc-500">Užklausų nėra.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      </>
      )}

      <div className="rounded-xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-lg font-medium">Pridėti užklausą rankiniu būdu</h2>
        <form action={createLead} className="grid max-w-2xl grid-cols-2 gap-3 text-sm">
          <input name="name" placeholder="Vardas *" required className="rounded-md border border-zinc-300 px-3 py-2" />
          <input name="company" placeholder="Įmonė" className="rounded-md border border-zinc-300 px-3 py-2" />
          <input name="email" type="email" placeholder="El. paštas" className="rounded-md border border-zinc-300 px-3 py-2" />
          <input name="phone" placeholder="Telefonas" className="rounded-md border border-zinc-300 px-3 py-2" />
          <textarea name="message" placeholder="Pastabos" rows={2} className="col-span-2 rounded-md border border-zinc-300 px-3 py-2" />
          <div>
            <button className="rounded-md bg-zinc-900 px-4 py-2 font-medium text-white hover:bg-zinc-700">
              Pridėti
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
