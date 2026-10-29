import { requireEditor } from "@/lib/auth";
import { IMAGE_SLOTS, getSiteImages } from "@/lib/site-images";
import { clearSiteImage } from "@/actions/site-images";
import { SiteImageSlot } from "@/components/admin/SiteImageSlot";
import { PageTitle } from "@/components/admin/ui";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export default async function SiteImagesAdmin() {
  await requireEditor();
  const map = await getSiteImages();
  const filled = Object.keys(map).length;
  const total = IMAGE_SLOTS.reduce((n, g) => n + g.slots.length, 0);
  return (
    <div className="space-y-6">
      <PageTitle>Svetainės nuotraukos</PageTitle>
      <p className="max-w-3xl text-sm text-zinc-600">
        Pagrindinio, paslaugų, „Apie mus“, kontaktų puslapių ir meniu nuotraukos (ne produktų ir ne projektų). Įkelkite failą arba įklijuokite nuorodą –
        nuotrauka išsaugoma aukšta kokybe (iki 2880 px). Kol vieta tuščia, rodoma laikina nuotrauka. Užpildyta: {filled} / {total}.
      </p>
      {IMAGE_SLOTS.map((g) => (
        <section key={g.group} className="space-y-2">
          <h2 className="font-semibold">{g.group}</h2>
          <div className="grid gap-2 lg:grid-cols-2">
            {g.slots.map((s) => (
              <div key={s.path} className="relative">
                <SiteImageSlot path={s.path} label={s.label} current={map[s.path] ?? null} />
                {map[s.path] && (
                  <form action={clearSiteImage.bind(null, s.path)} className="absolute right-2 top-2">
                    <button className="text-xs text-zinc-400 hover:text-red-600" title="Grąžinti laikiną">×</button>
                  </form>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
