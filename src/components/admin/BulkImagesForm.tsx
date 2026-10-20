"use client";

import { useActionState } from "react";
import { importImages } from "@/actions/catalogue-import";
import { Card, Notice, PrimaryButton } from "@/components/admin/ui";

/** Attach many photos at once: file names must start with the product SKU, e.g. "A1234_1.jpg". */
export function BulkImagesForm() {
  const [result, action, pending] = useActionState(importImages, null);
  return (
    <Card title="3. Nuotraukos pagal SKU (daug iš karto)">
      <form action={action} className="space-y-3">
        <p className="text-sm text-zinc-600">
          Pervadinkite failus pagal produkto SKU: <code>SKU.jpg</code>, <code>SKU_1.jpg</code>, <code>SKU_2.jpg</code>, <code>SKU-front.png</code>…
          Kiekviena nuotrauka prisegama prie produkto su tuo kodu (arba su tokiu pačiu adresu/slug). Iki 8 MB, JPG / PNG / WebP.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <input type="file" name="images" accept="image/*" multiple required className="text-sm" />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="replace" /> Pakeisti esamas produkto nuotraukas</label>
          <PrimaryButton type="submit" disabled={pending}>{pending ? "Įkeliama…" : "Įkelti nuotraukas"}</PrimaryButton>
        </div>
      </form>
      {result?.error && <div className="mt-3"><Notice tone="red">{result.error}</Notice></div>}
      {result && !result.error && (
        <div className="mt-3 space-y-2">
          <Notice tone="green">Prisegta nuotraukų: {result.attached}.</Notice>
          {result.unmatched.length > 0 && (
            <Notice tone="red">Nerasta produkto ({result.unmatched.length}): {result.unmatched.slice(0, 10).join(", ")}{result.unmatched.length > 10 ? "…" : ""}</Notice>
          )}
        </div>
      )}
    </Card>
  );
}
