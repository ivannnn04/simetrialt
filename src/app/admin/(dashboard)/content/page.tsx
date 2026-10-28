import { requireEditor } from "@/lib/auth";
import Link from "next/link";
import { CONTENT_SECTIONS } from "@/lib/content-sections";
import { LOCALES, LOCALE_LABELS } from "@/i18n/config";
import { getContentOverrides } from "@/lib/site-content";
import { Card, PageTitle } from "@/components/admin/ui";

export default async function ContentIndex() {
  await requireEditor();
  const edited = await Promise.all(LOCALES.map(async (l) => [l, Object.keys(await getContentOverrides(l))] as const));
  const count = (locale: string, key: string) =>
    (edited.find(([l]) => l === locale)?.[1] ?? []).filter((p) => p === key || p.startsWith(`${key}.`)).length;
  return (
    <div className="space-y-6">
      <PageTitle>Svetainės tekstai</PageTitle>
      <p className="max-w-2xl text-sm text-zinc-600">
        Kiekviena sekcija turi anglišką ir lietuvišką versiją. Pakeitimai įsigalioja iš karto; nepakeisti laukai rodo kode
        esančius tekstus, kuriuos bet kada galima atstatyti.
      </p>
      <Card>
        <table className="w-full text-sm">
          <thead className="text-left text-zinc-500">
            <tr>
              <th className="pb-2 font-medium">Sekcija</th>
              {LOCALES.map((l) => (
                <th key={l} className="pb-2 font-medium">
                  {LOCALE_LABELS[l]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CONTENT_SECTIONS.map((s) => (
              <tr key={s.key} className="border-t border-zinc-100">
                <td className="py-3 pr-4">
                  <p className="font-medium">{s.label}</p>
                  {s.hint && <p className="text-xs text-zinc-500">{s.hint}</p>}
                </td>
                {LOCALES.map((l) => {
                  const n = count(l, s.key);
                  return (
                    <td key={l} className="py-3 pr-4">
                      <Link href={`/admin/content/${s.key}?locale=${l}`} className="rounded-md border border-zinc-300 px-3 py-1 hover:bg-zinc-50">
                        Redaguoti
                      </Link>
                      {n > 0 && <span className="ml-2 text-xs text-zinc-500">{n} pakeist.</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
