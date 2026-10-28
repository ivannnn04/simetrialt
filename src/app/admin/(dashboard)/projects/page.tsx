import { requireEditor } from "@/lib/auth";
import Link from "next/link";
import { getProjects } from "@/lib/site-content";
import { moveProject } from "@/actions/site-data";
import { Badge, Card, PageTitle, PrimaryLink } from "@/components/admin/ui";

const TYPE_LABEL: Record<string, string> = { private: "Privatus", public: "Viešas", other: "Kita" };

export default async function ProjectsAdmin() {
  await requireEditor();
  const projects = await getProjects();
  return (
    <div className="space-y-6">
      <PageTitle actions={<PrimaryLink href="/admin/projects/new">+ Naujas projektas</PrimaryLink>}>Projektai</PageTitle>
      <p className="max-w-2xl text-sm text-zinc-600">
        Projektai rodomi puslapyje „Projektai“, prekių ženklų puslapiuose ir turi savo vidinį puslapį. Tvarka sąraše – tokia
        pati kaip svetainėje.
      </p>
      <Card className="p-0">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-zinc-500">
            <tr>
              <th className="p-4 font-medium">Projektas</th>
              <th className="p-4 font-medium">Kategorija</th>
              <th className="p-4 font-medium">Tipas</th>
              <th className="p-4 font-medium">Adresas</th>
              <th className="p-4 font-medium">Tvarka</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((p, i) => (
              <tr key={p.slug} className="border-t border-zinc-100 hover:bg-zinc-50">
                <td className="p-4">
                  <Link href={`/admin/projects/${p.slug}`} className="flex items-center gap-3 font-medium hover:underline">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.image} alt="" className="h-10 w-14 rounded bg-zinc-100 object-cover" />
                    {p.name}
                  </Link>
                </td>
                <td className="p-4 text-zinc-500">{p.category}</td>
                <td className="p-4">
                  <Badge tone="blue">{TYPE_LABEL[p.type] ?? p.type}</Badge>
                </td>
                <td className="p-4 text-zinc-500">/projects/{p.slug}</td>
                <td className="p-4">
                  <div className="flex gap-1">
                    <form action={moveProject.bind(null, p.slug, -1)}>
                      <button disabled={i === 0} className="rounded border border-zinc-300 px-2 py-0.5 text-xs disabled:opacity-30" title="Aukštyn">↑</button>
                    </form>
                    <form action={moveProject.bind(null, p.slug, 1)}>
                      <button disabled={i === projects.length - 1} className="rounded border border-zinc-300 px-2 py-0.5 text-xs disabled:opacity-30" title="Žemyn">↓</button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {projects.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-zinc-500">Projektų dar nėra.</td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
