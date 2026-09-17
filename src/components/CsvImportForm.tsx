"use client";

import { useActionState } from "react";
import { importCatalogueCsv } from "@/actions/products";

export function CsvImportForm() {
  const [state, formAction, pending] = useActionState(importCatalogueCsv, undefined);
  return (
    <form action={formAction} className="rounded-xl bg-white p-5 shadow-sm">
      <h2 className="mb-2 text-lg font-medium">Katalogo įkėlimas (CSV)</h2>
      <p className="mb-3 text-sm text-zinc-500">
        Stulpeliai: <code>name, sku, price, sale_price, currency, category, brand, typology, material, in_showroom, description, published</code>.
        Produktai atnaujinami pagal SKU arba pavadinimą.
      </p>
      <div className="flex items-center gap-3">
        <input type="file" name="file" accept=".csv,text/csv" required className="text-sm" />
        <button
          disabled={pending}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
        >
          {pending ? "Importuojama…" : "Importuoti"}
        </button>
      </div>
      {state?.message && <p className="mt-3 text-sm text-green-700">{state.message}</p>}
      {state?.error && <p className="mt-3 text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
