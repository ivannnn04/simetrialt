import { CatalogueWizard } from "@/components/admin/CatalogueWizard";

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
    </div>
  );
}
