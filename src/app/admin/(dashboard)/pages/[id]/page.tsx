import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PageForm } from "@/components/PageForm";

export default async function EditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const page = await db.page.findUnique({ where: { id } });
  if (!page) notFound();
  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Redaguoti: {page.title}</h1>
      <PageForm page={page} />
    </div>
  );
}
