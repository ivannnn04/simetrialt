import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { ProductForm } from "@/components/ProductForm";

export default async function EditProduct({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [product, categories] = await Promise.all([
    db.product.findUnique({
      where: { id },
      include: { images: { orderBy: { sort: "asc" } } },
    }),
    db.category.findMany({ orderBy: { sort: "asc" } }),
  ]);
  if (!product) notFound();
  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Redaguoti: {product.name}</h1>
      <ProductForm product={product} categories={categories} />
    </div>
  );
}
