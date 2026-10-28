import { db } from "@/lib/db";
import { requireEditor } from "@/lib/auth";
import { ProductForm } from "@/components/ProductForm";

export default async function NewProduct() {
  await requireEditor();
  const categories = await db.category.findMany({ orderBy: { sort: "asc" } });
  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Naujas produktas</h1>
      <ProductForm product={null} categories={categories} />
    </div>
  );
}
