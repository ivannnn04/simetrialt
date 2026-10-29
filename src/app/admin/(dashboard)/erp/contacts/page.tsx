import Link from "next/link";
import { db } from "@/lib/db";
import { CONTACT_CATEGORIES, CONTACT_TAGS } from "@/lib/erp/config";
import { docTotals, eur } from "@/lib/erp/money";
import { Td, Th } from "@/components/erp/ErpUi";
import { cn } from "@/lib/cn";

export const dynamic = "force-dynamic";

export default async function ErpContacts({ searchParams }: { searchParams: Promise<{ q?: string; category?: string; tag?: string }> }) {
  const f = await searchParams;
  const q = f.q?.trim();
  const contacts = await db.erpContact.findMany({
    where: {
      deleted: false,
      ...(f.category ? { category: f.category } : {}),
      ...(f.tag ? { tags: { has: f.tag } } : {}),
      ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }, { phone: { contains: q } }, { regCode: { contains: q } }] } : {}),
    },
    orderBy: { name: "asc" },
    take: 500,
    include: {
      company: { select: { name: true } },
      clientDocs: { where: { type: "INVOICE", deleted: false }, include: { lines: true } },
      partyDocs: { where: { type: "INVOICE", deleted: false }, include: { lines: true } },
      _count: { select: { clientDocs: true, partyDocs: true, supplierDocs: true } },
    },
  });
  const counts = await db.erpContact.groupBy({ by: ["category"], where: { deleted: false }, _count: true });
  const byCat = Object.fromEntries(counts.map((c) => [c.category, c._count]));
  const link = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams(Object.entries({ ...f, ...patch }).filter(([, v]) => v) as [string, string][]);
    return `/admin/erp/contacts${p.size ? `?${p}` : ""}`;
  };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Kontaktai</h1>
        <Link href="/admin/erp/contacts/new" className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white">+ Naujas kontaktas</Link>
      </div>
      <form className="flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="Vardas, įmonė, el. paštas, telefonas, įm. kodas…" className="w-80 rounded-md border border-zinc-300 px-2 py-1.5 text-sm" />
        {f.category && <input type="hidden" name="category" value={f.category} />}
        <button className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm text-white">Ieškoti</button>
      </form>
      <div className="flex flex-wrap gap-1.5">
        <Link href={link({ category: undefined })} className={cn("rounded-full border px-2.5 py-1 text-xs", !f.category ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 bg-white")}>Visi</Link>
        {CONTACT_CATEGORIES.map((c) => (
          <Link key={c} href={link({ category: c })} className={cn("rounded-full border px-2.5 py-1 text-xs", f.category === c ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 bg-white")}>
            {c} <span className="opacity-60">{byCat[c] ?? 0}</span>
          </Link>
        ))}
        <span className="mx-2 border-l border-zinc-200" />
        {CONTACT_TAGS.map((t) => (
          <Link key={t} href={link({ tag: f.tag === t ? undefined : t })} className={cn("rounded-full border px-2.5 py-1 text-xs", f.tag === t ? "border-amber-600 bg-amber-50" : "border-dashed border-zinc-300 bg-white text-zinc-600")}>#{t}</Link>
        ))}
      </div>
      <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b border-zinc-100 bg-zinc-50"><tr><Th>Pavadinimas</Th><Th>Kategorija</Th><Th>Žymos</Th><Th>Kontaktai</Th><Th right>Dokumentai</Th><Th right>Pardavimai (be PVM)</Th></tr></thead>
          <tbody>
            {contacts.map((c) => {
              const sales = [...c.clientDocs, ...(c.category === "Architektas" || c.category === "Partneris" ? c.partyDocs : [])].reduce((n, d) => n + docTotals(d.lines, d.discountPct).net, 0);
              return (
                <tr key={c.id} className="border-b border-zinc-50 hover:bg-zinc-50">
                  <Td>
                    <Link href={`/admin/erp/contacts/${c.id}`} className="font-medium underline">{c.name}</Link>
                    {c.company && <p className="text-xs text-zinc-500">{c.position ? `${c.position}, ` : ""}{c.company.name}</p>}
                  </Td>
                  <Td><span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs">{c.category}</span></Td>
                  <Td className="text-xs text-zinc-500">{c.tags.join(", ")}</Td>
                  <Td className="text-xs text-zinc-600">{[c.email, c.phone].filter(Boolean).join(" · ")}</Td>
                  <Td right>{c._count.clientDocs + c._count.partyDocs + c._count.supplierDocs}</Td>
                  <Td right>{sales ? eur(sales) : <span className="text-zinc-400">—</span>}</Td>
                </tr>
              );
            })}
            {contacts.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-zinc-500">Kontaktų nerasta.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
