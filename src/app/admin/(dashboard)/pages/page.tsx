import Link from "next/link";
import { db } from "@/lib/db";

export default async function PagesList() {
  const pages = await db.page.findMany({ orderBy: { updatedAt: "desc" } });
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Puslapiai</h1>
        <Link
          href="/admin/pages/new"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
        >
          + Naujas puslapis
        </Link>
      </div>
      <div className="overflow-hidden rounded-xl bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-zinc-500">
            <tr>
              <th className="p-4 font-medium">Pavadinimas</th>
              <th className="p-4 font-medium">Nuoroda</th>
              <th className="p-4 font-medium">Būsena</th>
              <th className="p-4 font-medium">Atnaujinta</th>
            </tr>
          </thead>
          <tbody>
            {pages.map((page) => (
              <tr key={page.id} className="border-t border-zinc-100 hover:bg-zinc-50">
                <td className="p-4">
                  <Link href={`/admin/pages/${page.id}`} className="font-medium hover:underline">
                    {page.title}
                  </Link>
                </td>
                <td className="p-4 text-zinc-500">/{page.slug}</td>
                <td className="p-4">
                  {page.published ? (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">Paskelbtas</span>
                  ) : (
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">Juodraštis</span>
                  )}
                </td>
                <td className="p-4 text-zinc-500">{page.updatedAt.toLocaleDateString("lt-LT")}</td>
              </tr>
            ))}
            {pages.length === 0 && (
              <tr>
                <td colSpan={4} className="p-6 text-center text-zinc-500">Puslapių dar nėra.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
