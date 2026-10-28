import { requireEditor } from "@/lib/auth";
import { PageForm } from "@/components/PageForm";

export default async function NewPage() {
  await requireEditor();
  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Naujas puslapis</h1>
      <PageForm page={null} />
    </div>
  );
}
