import { getContacts, getSlides } from "@/lib/site-content";
import { saveSettings } from "@/actions/site-data";
import { Card, Field, Input, Notice, PageTitle, PrimaryButton } from "@/components/admin/ui";

export default async function SettingsAdmin({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const [sp, c, slides] = await Promise.all([searchParams, getContacts(), getSlides()]);
  return (
    <div className="space-y-6">
      <PageTitle>Kontaktai ir nustatymai</PageTitle>
      {sp.saved && <Notice tone="green">Išsaugota. Pakeitimai matomi poraštėje, kontaktų puslapyje ir PDF.</Notice>}
      <form action={saveSettings} className="max-w-3xl space-y-6">
        <Card title="Kontaktai">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Telefonas (rodomas)">
              <Input name="phone" defaultValue={c.phone} />
            </Field>
            <Field label="Telefono nuoroda" hint="tel:+370… (palikite tuščią – sudarys iš numerio)">
              <Input name="phoneHref" defaultValue={c.phoneHref} />
            </Field>
            <Field label="El. paštas">
              <Input name="email" type="email" defaultValue={c.email} />
            </Field>
            <Field label="Salono adresas (PDF, meta)">
              <Input name="address" defaultValue={c.address} />
            </Field>
            <Field label="Žemėlapio nuoroda" className="md:col-span-2">
              <Input name="mapUrl" defaultValue={c.mapUrl} />
            </Field>
          </div>
        </Card>

        <Card title="Socialiniai tinklai ir dokumentai">
          <p className="mb-3 text-xs text-zinc-500">Tuščias laukas – nuoroda neaktyvi („#“).</p>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Instagram">
              <Input name="instagram" defaultValue={c.instagram === "#" ? "" : c.instagram} placeholder="https://instagram.com/…" />
            </Field>
            <Field label="Facebook">
              <Input name="facebook" defaultValue={c.facebook === "#" ? "" : c.facebook} placeholder="https://facebook.com/…" />
            </Field>
            <Field label="LinkedIn">
              <Input name="linkedin" defaultValue={c.linkedin === "#" ? "" : c.linkedin} placeholder="https://linkedin.com/company/…" />
            </Field>
            <Field label="Privatumo politika (nuoroda)" hint="Galite sukurti puslapį skiltyje „Papildomi puslapiai“ ir įrašyti /jo-adresas">
              <Input name="privacyUrl" defaultValue={c.privacyUrl === "#" ? "" : c.privacyUrl} placeholder="/privatumo-politika" />
            </Field>
            <Field label="Slapukų politika (nuoroda)">
              <Input name="cookieUrl" defaultValue={c.cookieUrl === "#" ? "" : c.cookieUrl} placeholder="/slapukai" />
            </Field>
          </div>
        </Card>

        <Card title="Projektų slankiklio nuotrauka (pagrindinis ir paslaugų puslapis)">
          <div className="flex items-start gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={slides.image} alt="" className="h-24 w-32 rounded-lg bg-zinc-100 object-cover" />
            <div className="flex-1 space-y-3">
              <Field label="Įkelti naują">
                <input type="file" name="slidesImageFile" accept="image/*" className="text-sm" />
              </Field>
              <Field label="arba nuoroda">
                <Input name="slidesImage" defaultValue={slides.image} />
              </Field>
              <p className="text-xs text-zinc-500">Skaidrių tekstai redaguojami: Tekstai → Pagrindinis puslapis → projects.</p>
            </div>
          </div>
        </Card>

        <PrimaryButton type="submit">Išsaugoti</PrimaryButton>
      </form>
    </div>
  );
}
