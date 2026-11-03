import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { priceChangeLog } from "@/actions/prices";
import { PageTitle } from "@/components/admin/ui";
import { BrandPriceChange } from "@/components/admin/BrandPriceChange";

export const dynamic = "force-dynamic";

/** Super admin: a supplier raises or lowers its prices – change every product of the brand at once. */
export default async function PricesPage() {
  await requireAdmin();
  const [brands, log] = await Promise.all([
    db.product.groupBy({ by: ["brand"], where: { brand: { not: null } }, _count: { _all: true }, orderBy: { brand: "asc" } }),
    priceChangeLog(),
  ]);
  return (
    <div className="max-w-5xl space-y-6">
      <PageTitle>Kainų keitimas pagal prekės ženklą</PageTitle>
      <p className="text-sm text-zinc-600">
        Kai tiekėjas pakeičia viso katalogo kainas, pakeiskite visų to prekės ženklo produktų kainas vienu kartu. Pirmiausia peržiūrėkite rezultatą; kiekvieną
        pakeitimą galima atšaukti.
      </p>
      <BrandPriceChange brands={brands.filter((b) => b.brand).map((b) => ({ name: b.brand!, count: b._count._all }))} log={log} />
    </div>
  );
}
