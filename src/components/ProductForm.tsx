import type { Category, Product, ProductImage } from "@prisma/client";
import { saveProduct, deleteProduct, deleteProductImage } from "@/actions/products";

type ProductWithImages = Product & { images: ProductImage[] };

export function ProductForm({
  product,
  categories,
}: {
  product: ProductWithImages | null;
  categories: Category[];
}) {
  const save = saveProduct.bind(null, product?.id ?? null);
  return (
    <div className="max-w-2xl space-y-6">
      {product && product.images.length > 0 && (
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-medium">Nuotraukos</h2>
          <div className="flex flex-wrap gap-3">
            {product.images.map((img) => (
              <form key={img.id} action={deleteProductImage.bind(null, img.id, product.id)} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt={img.alt} className="h-24 w-24 rounded-lg object-cover" />
                <button
                  className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-xs text-white"
                  title="Ištrinti nuotrauką"
                >
                  ×
                </button>
              </form>
            ))}
          </div>
        </div>
      )}

      <form action={save} className="space-y-4 rounded-xl bg-white p-5 shadow-sm">
        <div>
          <label className="mb-1 block text-sm font-medium">Pavadinimas</label>
          <input name="name" defaultValue={product?.name} required className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium">SKU</label>
            <input name="sku" defaultValue={product?.sku ?? ""} className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Nuoroda (slug)</label>
            <input name="slug" defaultValue={product?.slug} className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Kaina</label>
            <input
              name="price"
              defaultValue={product ? (product.priceCents / 100).toFixed(2) : ""}
              placeholder="0.00"
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Valiuta</label>
            <input name="currency" defaultValue={product?.currency ?? "EUR"} className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Kategorija</label>
            <select name="categoryId" defaultValue={product?.categoryId ?? ""} className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm">
              <option value="">— be kategorijos —</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Akcijos kaina</label>
            <input
              name="salePrice"
              defaultValue={product?.salePriceCents != null ? (product.salePriceCents / 100).toFixed(2) : ""}
              placeholder="—"
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Prekės ženklas</label>
            <input name="brand" defaultValue={product?.brand ?? ""} className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Tipologija</label>
            <input name="typology" defaultValue={product?.typology ?? ""} placeholder="pvz. 3-seater" className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Medžiaga</label>
            <input name="material" defaultValue={product?.material ?? ""} className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" />
          </div>
          <label className="flex items-center gap-2 self-end pb-2 text-sm">
            <input type="checkbox" name="inShowroom" defaultChecked={product?.inShowroom} />
            Yra salone
          </label>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Aprašymas</label>
          <textarea name="description" defaultValue={product?.description} rows={8} className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Pridėti nuotraukų</label>
          <input type="file" name="images" accept="image/*" multiple className="text-sm" />
          <p className="mt-1 text-xs text-zinc-500">JPG, PNG, WebP arba GIF, iki 8 MB.</p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="published" defaultChecked={product?.published} />
          Rodyti kataloge
        </label>
        <div className="flex gap-3">
          <button className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700">
            Išsaugoti
          </button>
          {product && (
            <button
              formAction={deleteProduct.bind(null, product.id)}
              className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              Ištrinti
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
