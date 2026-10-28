import { requireEditor } from "@/lib/auth";
import Link from "next/link";
import { getBrands } from "@/lib/site-content";
import { moveBrand } from "@/actions/site-data";
import { Card, PageTitle, PrimaryLink } from "@/components/admin/ui";

export default async function BrandsAdmin() {
  await requireEditor();
  const brands = await getBrands();
  return (
    <div className="space-y-6">
      <PageTitle actions={<PrimaryLink href="/admin/brands/new">+ Naujas prekės ženklas</PrimaryLink>}>Prekių ženklai</PageTitle>
      <p className="max-w-2xl text-sm text-zinc-600">
        Rodomi puslapyje „Prekių ženklai“ ir turi savo vidinį puslapį su kolekcijomis. Tvarka – kaip svetainėje.
      </p>
      <Card className="p-0">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-zinc-500">
            <tr>
              <th className="p-4 font-medium">Pavadinimas</th>
              <th className="p-4 font-medium">Kategorija</th>
              <th className="p-4 font-medium">Šalis</th>
              <th className="p-4 font-medium">Kolekcijos</th>
              <th className="p-4 font-medium">Tvarka</th>
            </tr>
          </thead>
          <tbody>
            {brands.map((b, i) => (
              <tr key={b.slug} className="border-t border-zinc-100 hover:bg-zinc-50">
                <td className="p-4">
                  <Link href={`/admin/brands/${b.slug}`} className="font-medium hover:underline">
                    {b.name}
                  </Link>
                  <p className="text-xs text-zinc-400">/brands/{b.slug}</p>
                </td>
                <td className="p-4 text-zinc-500">{b.category}</td>
                <td className="p-4 text-zinc-500">{b.country}</td>
                <td className="p-4 text-zinc-500">{b.collections.length}</td>
                <td className="p-4">
                  <div className="flex gap-1">
                    <form action={moveBrand.bind(null, b.slug, -1)}>
                      <button disabled={i === 0} className="rounded border border-zinc-300 px-2 py-0.5 text-xs disabled:opacity-30" title="Aukštyn">↑</button>
                    </form>
                    <form action={moveBrand.bind(null, b.slug, 1)}>
                      <button disabled={i === brands.length - 1} className="rounded border border-zinc-300 px-2 py-0.5 text-xs disabled:opacity-30" title="Žemyn">↓</button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
