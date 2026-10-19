import Link from "next/link";
import { notFound } from "next/navigation";
import { LOCALES, LOCALE_LABELS, isLocale, DEFAULT_LOCALE } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { applyOverrides, collectFields, getPath } from "@/i18n/overrides";
import { getContentOverrides } from "@/lib/site-content";
import { CONTENT_SECTIONS, sectionLabel } from "@/lib/content-sections";
import { resetContentSection, saveContentSection } from "@/actions/content";
import { Card, Input, Notice, PageTitle, PrimaryButton, Textarea } from "@/components/admin/ui";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { cn } from "@/lib/cn";

/** Human label for a dot-path inside the section: "hero.title.0" → "hero › title › 1". */
function labelFor(path: string, section: string) {
  const rest = path.startsWith(`${section}.`) ? path.slice(section.length + 1) : path;
  return rest
    .split(".")
    .map((p) => (/^\d+$/.test(p) ? String(Number(p) + 1) : p.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase()))
    .join(" › ");
}

export default async function ContentSection({
  params,
  searchParams,
}: {
  params: Promise<{ section: string }>;
  searchParams: Promise<{ locale?: string; saved?: string; reset?: string }>;
}) {
  const [{ section }, sp] = await Promise.all([params, searchParams]);
  if (!CONTENT_SECTIONS.some((s) => s.key === section)) notFound();
  const locale = isLocale(sp.locale) ? sp.locale : DEFAULT_LOCALE;

  const defaults = getDictionary(locale);
  const overrides = await getContentOverrides(locale);
  const current = applyOverrides(defaults, overrides);
  const fields = collectFields(getPath(current, section), section);
  const changed = new Set(Object.keys(overrides).filter((p) => p === section || p.startsWith(`${section}.`)));

  const save = saveContentSection.bind(null, locale, section);
  const reset = resetContentSection.bind(null, locale, section);

  // Group fields by their first sub-key so long sections read as blocks.
  const groups = new Map<string, typeof fields>();
  for (const f of fields) {
    const rest = f.path.startsWith(`${section}.`) ? f.path.slice(section.length + 1) : "";
    const head = rest.split(".")[0] || "—";
    groups.set(head, [...(groups.get(head) ?? []), f]);
  }

  return (
    <div className="space-y-6">
      <PageTitle
        actions={
          <div className="flex items-center gap-2 text-sm">
            {LOCALES.map((l) => (
              <Link
                key={l}
                href={`/admin/content/${section}?locale=${l}`}
                className={cn("rounded-full px-3 py-1", l === locale ? "bg-zinc-900 text-white" : "bg-white shadow-sm hover:bg-zinc-50")}
              >
                {LOCALE_LABELS[l]}
              </Link>
            ))}
          </div>
        }
      >
        {sectionLabel(section)} <span className="text-base font-normal text-zinc-500">· {LOCALE_LABELS[locale]}</span>
      </PageTitle>

      <p className="text-sm text-zinc-500">
        <Link href="/admin/content" className="hover:underline">
          ← Visos sekcijos
        </Link>
      </p>

      {sp.saved && <Notice tone="green">Išsaugota. Pakeitimai jau matomi svetainėje.</Notice>}
      {sp.reset && <Notice tone="green">Sekcija atstatyta į pradinius tekstus.</Notice>}
      {fields.length === 0 && (
        <Notice>
          Šioje kalboje sekcija neturi redaguojamų laukų (turinys gyvena kode). Pasirinkite kitą kalbą arba sekciją.
        </Notice>
      )}

      {fields.length > 0 && (
        <form action={save} className="space-y-6">
          {[...groups.entries()].map(([head, list]) => (
            <Card key={head} title={head === "—" ? undefined : head.replace(/([a-z])([A-Z])/g, "$1 $2")}>
              <div className="grid gap-4 md:grid-cols-2">
                {list.map((f) => {
                  const long = f.kind === "lines" || f.value.length > 70;
                  const edited = changed.has(f.path);
                  return (
                    <div key={f.path} className={cn(long && "md:col-span-2")}>
                      <label className="mb-1 flex items-center gap-2 text-xs font-medium text-zinc-600">
                        {labelFor(f.path, section)}
                        {edited && <span className="rounded-full bg-amber-100 px-1.5 text-[10px] text-amber-700">pakeista</span>}
                      </label>
                      <input type="hidden" name={`k:${f.path}`} value={f.kind} />
                      {f.kind === "lines" ? (
                        <Textarea name={`f:${f.path}`} defaultValue={(f.value as string[]).join("\n")} rows={Math.min(10, Math.max(3, (f.value as string[]).length + 1))} />
                      ) : long ? (
                        <Textarea name={`f:${f.path}`} defaultValue={f.value as string} rows={Math.min(8, Math.max(2, Math.ceil((f.value as string).length / 90) + 1))} />
                      ) : (
                        <Input name={`f:${f.path}`} defaultValue={f.value as string} />
                      )}
                      {f.kind === "lines" && <p className="mt-1 text-[11px] text-zinc-400">Po vieną elementą eilutėje</p>}
                    </div>
                  );
                })}
              </div>
            </Card>
          ))}
          <div className="sticky bottom-0 flex items-center justify-between gap-4 rounded-xl border border-zinc-200 bg-white/95 p-4 shadow-sm backdrop-blur">
            <PrimaryButton type="submit">Išsaugoti pakeitimus</PrimaryButton>
            <ConfirmButton type="submit" formAction={reset} message="Atstatyti visus šios sekcijos tekstus į pradinius?" disabled={changed.size === 0}>
              Atstatyti pradinius ({changed.size})
            </ConfirmButton>
          </div>
        </form>
      )}
    </div>
  );
}
