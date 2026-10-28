import { requireEditor } from "@/lib/auth";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getBrandBySlug } from "@/lib/site-content";
import { deleteBrand, saveBrand } from "@/actions/site-data";
import { Card, Field, Input, Notice, PageTitle, PrimaryButton, Textarea } from "@/components/admin/ui";
import { ConfirmButton } from "@/components/admin/ConfirmButton";

export default async function BrandEdit({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  await requireEditor();
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const isNew = slug === "new";
  const brand = isNew ? null : await getBrandBySlug(slug);
  if (!isNew && !brand) notFound();

  const save = saveBrand.bind(null, brand?.slug ?? null);
  const remove = brand ? deleteBrand.bind(null, brand.slug) : null;

  return (
    <div className="space-y-6">
      <PageTitle>{isNew ? "Naujas prekės ženklas" : `Redaguoti: ${brand!.name}`}</PageTitle>
      <p className="text-sm text-zinc-500">
        <Link href="/admin/brands" className="hover:underline">← Visi prekių ženklai</Link>
        {brand && (
          <>
            {" · "}
            <Link href={`/brands/${brand.slug}`} target="_blank" className="hover:underline">Peržiūrėti svetainėje ↗</Link>
          </>
        )}
      </p>
      {sp.saved && <Notice tone="green">Išsaugota.</Notice>}

      <form action={save} className="max-w-3xl space-y-6">
        <Card title="Pagrindiniai duomenys">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Pavadinimas">
              <Input name="name" defaultValue={brand?.name} required />
            </Field>
            <Field label="Adresas (slug)" hint="Palikite tuščią – sugeneruos iš pavadinimo">
              <Input name="slug" defaultValue={brand?.slug} />
            </Field>
            <Field label="Kategorija" hint="Furniture, Lighting… (verčiama pagal terminus)">
              <Input name="category" defaultValue={brand?.category} />
            </Field>
            <Field label="Šalis">
              <Input name="country" defaultValue={brand?.country} />
            </Field>
          </div>
        </Card>

        <Card title="Logotipo užrašas">
          <p className="mb-3 text-xs text-zinc-500">
            Kol nėra logotipų failų, prekės ženklas rodomas kaip tekstas. Nuotraukos imamos iš <code>/images/brands/&lt;slug&gt;.jpg</code>,
            kolekcijų – <code>/images/brands/&lt;slug&gt;-collection-N.jpg</code>, CTA – <code>/images/brands/&lt;slug&gt;-cta.jpg</code>.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Tekstas" hint="Palikite tuščią – rodys pavadinimą">
              <Input name="markText" defaultValue={brand?.mark?.text} />
            </Field>
            <Field label="Stilius (Tailwind klasės)" hint="Pvz. font-bold text-[36px] tracking-[0.3em]">
              <Input name="markClass" defaultValue={brand?.mark?.className} />
            </Field>
          </div>
        </Card>

        <Card title="Kolekcijos">
          <Field label="Kolekcijų sąrašas" hint="Po vieną eilutėje: „Pavadinimas | aukštis“ (458, 366 arba 275 px; aukštį galima praleisti)">
            <Textarea name="collections" rows={8} defaultValue={brand?.collections.map((c) => `${c.title} | ${c.height}`).join("\n")} />
          </Field>
        </Card>

        <div className="flex items-center justify-between">
          <PrimaryButton type="submit">{isNew ? "Sukurti" : "Išsaugoti"}</PrimaryButton>
          {remove && (
            <ConfirmButton type="submit" formAction={remove} message={`Ištrinti prekės ženklą „${brand!.name}“?`}>
              Ištrinti
            </ConfirmButton>
          )}
        </div>
      </form>
    </div>
  );
}
