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
          Įkelkite PDF katalogą ir kainoraštį – produktai bus sudaryti automatiškai, peržiūrėsite juos taip, kaip atrodys svetainėje,
          ir tik tada įrašysite į katalogą.
        </p>
      </div>
      <CatalogueWizard />
      <div>
        <h2 className="mb-1 text-lg font-semibold">Greitasis importas be peržiūros</h2>
        <p className="mb-4 text-sm text-zinc-600">Tik kainoraštis (CSV / Excel) ir nuotraukos pagal SKU – be PDF ir be peržiūros.</p>
        <div className="space-y-6">
          <CatalogueImport />
          <BulkImagesForm />
        </div>
      </div>
    </div>
  );
}
