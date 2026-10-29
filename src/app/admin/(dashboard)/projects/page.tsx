import { requireEditor } from "@/lib/auth";
import Link from "next/link";
import { getProjects } from "@/lib/site-content";
import { moveProject } from "@/actions/site-data";
import { importLegacyProjects } from "@/actions/legacy-projects";
import { RehostPhotos } from "@/components/admin/RehostPhotos";
import { Badge, Card, Notice, PageTitle, PrimaryButton, PrimaryLink, Textarea } from "@/components/admin/ui";

const TYPE_LABEL: Record<string, string> = { private: "Privatus", public: "Viešas", other: "Kita" };

export default async function ProjectsAdmin({ searchParams }: { searchParams: Promise<{ imported?: string; updated?: string; import?: string }> }) {
  await requireEditor();
  const [projects, sp] = await Promise.all([getProjects(), searchParams]);
  const external = projects.reduce(
    (n, p) => n + new Set([p.image, ...(p.gallery ?? [])].filter((u) => /^https?:\/\//.test(u) && !/\.blob\.vercel-storage\.com\//.test(u))).size,
    0
  );
  return (
    <div className="space-y-6">
      <PageTitle actions={<PrimaryLink href="/admin/projects/new">+ Naujas projektas</PrimaryLink>}>Projektai</PageTitle>
      <p className="max-w-2xl text-sm text-zinc-600">
        Projektai rodomi puslapyje „Projektai“, prekių ženklų puslapiuose ir turi savo vidinį puslapį. Tvarka sąraše – tokia
        pati kaip svetainėje.
      </p>
      {sp.imported !== undefined && (
        <Notice tone="green">
          Importuota naujų projektų: {sp.imported}
          {Number(sp.updated) ? `, atnaujinta: ${sp.updated}` : ""}.
        </Notice>
      )}
      {sp.import === "bad" && <Notice tone="red">Nepavyko perskaityti JSON.</Notice>}
      {sp.import === "empty" && <Notice tone="red">Įklijuokite eksportuotus duomenis.</Notice>}
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
      <Card title="Nuotraukos">
        <p className="mb-3 text-sm text-zinc-600">
          Importuotų projektų nuotraukos kol kas rodomos iš senos svetainės (simetria.lt). Prieš išjungiant seną svetainę,
          perkelkite jas į šios svetainės saugyklą – originali kokybė išlieka.
        </p>
        <RehostPhotos external={external} />
      </Card>
      <Card title="Importas iš senos svetainės">
        <form action={importLegacyProjects} className="space-y-3">
          <p className="text-sm text-zinc-600">
            Įklijuokite senos svetainės projektų eksportą (JSON). Kiekvienas projektas gauna nuotraukų galeriją, autorius,
            naudotus prekių ženklus ir tekstą anglų bei lietuvių kalbomis.
          </p>
          <Textarea name="json" rows={6} placeholder='[{"slug":"…","title":"…","images":["…"]}]' className="font-mono text-xs" />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="dropSamples" defaultChecked /> Pašalinti pavyzdinius projektus (Baltic Innovation HQ ir kt.)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="overwrite" /> Perrašyti jau esamus projektus tuo pačiu adresu
          </label>
          <PrimaryButton type="submit">Importuoti</PrimaryButton>
        </form>
      </Card>
    </div>
  );
}
