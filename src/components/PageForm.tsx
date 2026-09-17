import { savePage, deletePage } from "@/actions/pages";
import type { Page } from "@prisma/client";

export function PageForm({ page }: { page: Page | null }) {
  const save = savePage.bind(null, page?.id ?? null);
  return (
    <form action={save} className="max-w-2xl space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium">Pavadinimas</label>
        <input
          name="title"
          defaultValue={page?.title}
          required
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">
          Nuoroda (slug) <span className="text-zinc-400">— palikite tuščią, sugeneruos automatiškai</span>
        </label>
        <input
          name="slug"
          defaultValue={page?.slug}
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Turinys</label>
        <textarea
          name="content"
          defaultValue={page?.content}
          rows={14}
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 font-mono text-sm"
        />
        <p className="mt-1 text-xs text-zinc-500">
          Paprastas tekstas; tuščia eilutė atskiria pastraipas, eilutės prasidedančios „## “ tampa antraštėmis.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium">SEO pavadinimas</label>
          <input
            name="metaTitle"
            defaultValue={page?.metaTitle ?? ""}
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">SEO aprašymas</label>
          <input
            name="metaDesc"
            defaultValue={page?.metaDesc ?? ""}
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
          />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="published" defaultChecked={page?.published} />
        Paskelbti viešai
      </label>
      <div className="flex gap-3">
        <button className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700">
          Išsaugoti
        </button>
        {page && (
          <button
            formAction={deletePage.bind(null, page.id)}
            className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            Ištrinti
          </button>
        )}
      </div>
    </form>
  );
}
