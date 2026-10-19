import Link from "next/link";
import { notFound } from "next/navigation";
import { getProjectBySlug } from "@/lib/site-content";
import { deleteProject, saveProject } from "@/actions/site-data";
import { Card, Field, Input, Notice, PageTitle, PrimaryButton, Select, Textarea } from "@/components/admin/ui";
import { ConfirmButton } from "@/components/admin/ConfirmButton";

export default async function ProjectEdit({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const isNew = slug === "new";
  const project = isNew ? null : await getProjectBySlug(slug);
  if (!isNew && !project) notFound();

  const save = saveProject.bind(null, project?.slug ?? null);
  const remove = project ? deleteProject.bind(null, project.slug) : null;

  return (
    <div className="space-y-6">
      <PageTitle>{isNew ? "Naujas projektas" : `Redaguoti: ${project!.name}`}</PageTitle>
      <p className="text-sm text-zinc-500">
        <Link href="/admin/projects" className="hover:underline">← Visi projektai</Link>
        {project && (
          <>
            {" · "}
            <Link href={`/projects/${project.slug}`} target="_blank" className="hover:underline">Peržiūrėti svetainėje ↗</Link>
          </>
        )}
      </p>
      {sp.saved && <Notice tone="green">Išsaugota.</Notice>}
      <Notice>
        Lietuviškame puslapyje projekto aprašymo tekstai (apie projektą, apšvietimas, specifikacijos) imami iš sekcijos
        „Projekto puslapis“ (Tekstai → LT). Čia redaguojamas angliškas turinys ir bendri duomenys.
      </Notice>

      <form action={save} className="max-w-3xl space-y-6">
        <Card title="Pagrindiniai duomenys">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Pavadinimas">
              <Input name="name" defaultValue={project?.name} required />
            </Field>
            <Field label="Adresas (slug)" hint="Palikite tuščią – sugeneruos iš pavadinimo">
              <Input name="slug" defaultValue={project?.slug} />
            </Field>
            <Field label="Kategorija" hint="Pvz. „Residential · Lighting design“ (verčiama automatiškai pagal terminus)">
              <Input name="category" defaultValue={project?.category} />
            </Field>
            <Field label="Rūšis (hero paantraštė)" hint="Residential, Apartment, Office, Hospitality, Culture…">
              <Input name="kind" defaultValue={project?.kind} />
            </Field>
            <Field label="Tipas (filtras projektų puslapyje)">
              <Select name="type" defaultValue={project?.type ?? "private"}>
                <option value="private">Privatus</option>
                <option value="public">Viešas</option>
                <option value="other">Kita</option>
              </Select>
            </Field>
          </div>
        </Card>

        <Card title="Viršelio nuotrauka">
          <div className="flex items-start gap-4">
            {project?.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={project.image} alt="" className="h-24 w-32 rounded-lg bg-zinc-100 object-cover" />
            )}
            <div className="flex-1 space-y-3">
              <Field label="Įkelti naują">
                <input type="file" name="imageFile" accept="image/*" className="text-sm" />
              </Field>
              <Field label="arba nuoroda į nuotrauką">
                <Input name="image" defaultValue={project?.image} placeholder="/images/projects/…/cover.jpg" />
              </Field>
              <p className="text-xs text-zinc-500">
                Vidinio puslapio nuotraukos imamos iš <code>/images/projects/&lt;slug&gt;/hero.jpg</code> ir kt. (žr. public/images/README.md).
              </p>
            </div>
          </div>
        </Card>

        <Card title="Vidinis puslapis (EN)">
          <div className="space-y-4">
            <Field label="„Apie projektą“ antraštė">
              <Input name="aboutTitle" defaultValue={project?.aboutTitle} />
            </Field>
            <Field label="„Apie projektą“ pastraipos" hint="Pastraipas skirkite tuščia eilute">
              <Textarea name="about" rows={7} defaultValue={project?.about.join("\n\n")} />
            </Field>
            <Field label="Antros sekcijos antraštė">
              <Input name="sectionTitle" defaultValue={project?.sectionTitle} />
            </Field>
            <Field label="Antros sekcijos tekstas">
              <Textarea name="sectionText" rows={4} defaultValue={project?.sectionText} />
            </Field>
            <Field label="Apšvietimo sekcijos antraštė">
              <Input name="lightTitle" defaultValue={project?.lightTitle} />
            </Field>
            <Field label="Apšvietimo sekcijos pastraipos" hint="Pastraipas skirkite tuščia eilute">
              <Textarea name="light" rows={6} defaultValue={project?.light.join("\n\n")} />
            </Field>
            <Field label="Specifikacijos" hint="Po vieną eilutėje: „Pavadinimas: reikšmė“">
              <Textarea name="specs" rows={8} defaultValue={project?.specs.map(([k, v]) => `${k}: ${v}`).join("\n")} />
            </Field>
          </div>
        </Card>

        <div className="flex items-center justify-between">
          <PrimaryButton type="submit">{isNew ? "Sukurti projektą" : "Išsaugoti"}</PrimaryButton>
          {remove && (
            <ConfirmButton type="submit" formAction={remove} message={`Ištrinti projektą „${project!.name}“?`}>
              Ištrinti projektą
            </ConfirmButton>
          )}
        </div>
      </form>
    </div>
  );
}
