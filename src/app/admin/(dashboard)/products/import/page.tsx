import { CatalogueWizard } from "@/components/admin/CatalogueWizard";
import { CatalogueImport } from "@/components/admin/CatalogueImport";
import { BulkImagesForm } from "@/components/admin/BulkImagesForm";

// PDF parsing and photo downloads can take a while on large catalogues.
export const maxDuration = 300;

export default function ImportPage() {
  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold">Importas iš tiekėjų katalogų</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Įkelkite tiekėjo dokumentus – produktai bus sudaryti automatiškai, peržiūrėsite juos taip, kaip atrodys svetainėje, ir tik
          tada įrašysite į katalogą.
        </p>
      </div>
      <CatalogueWizard blobUploads={Boolean(process.env.BLOB_READ_WRITE_TOKEN)} />
      <details className="rounded-xl border border-zinc-200 p-5">
        <summary className="cursor-pointer text-sm font-medium text-zinc-700">Papildomai: greitasis kainoraščio importas be peržiūros ir nuotraukos pagal SKU</summary>
        <div className="mt-5 space-y-6">
          <CatalogueImport />
          <BulkImagesForm />
        </div>
      </details>
    </div>
  );
}
