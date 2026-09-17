import { PageForm } from "@/components/PageForm";

export default function NewPage() {
  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Naujas puslapis</h1>
      <PageForm page={null} />
    </div>
  );
}
