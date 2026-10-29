import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { isConfigured, scoroConfig } from "@/lib/scoro/client";
import { pendingProductsWhere, siteUrl } from "@/lib/scoro/sync";
import { retryScoroTasks } from "@/actions/scoro";
import { ScoroPanel } from "@/components/admin/ScoroPanel";
import { Badge, Card, PageTitle } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export default async function ScoroAdmin() {
  await requireAdmin();
  const c = await scoroConfig();
  const [products, linked, pending, tasks, failedTasks, quotesFromScoro, logs] = await Promise.all([
    db.product.count(),
    db.product.count({ where: { scoroId: { not: null } } }),
    db.product.count({ where: pendingProductsWhere() }),
    db.scoroTask.count({ where: { attempts: { lt: 8 } } }),
    db.scoroTask.findMany({ where: { lastError: { not: null } }, orderBy: { updatedAt: "desc" }, take: 10 }),
    db.quote.count({ where: { source: "scoro" } }),
    db.scoroLog.findMany({ orderBy: { createdAt: "desc" }, take: 40 }),
  ]);
  const site = siteUrl();
  const stats = [
    { label: "Ryšys", value: isConfigured(c) ? "Sukonfigūruotas" : "Nesukonfigūruotas" },
    { label: "Produktai Scoro", value: `${linked} / ${products}` },
    { label: "Laukia siuntimo", value: c.pushProducts ? `${pending} prod. · ${tasks} užd.` : `${tasks} užd. (produktai išjungti)` },
    { label: "Pasiūlymai iš Scoro", value: String(quotesFromScoro) },
  ];
  return (
    <div className="space-y-6">
      <PageTitle>Scoro CRM</PageTitle>
      <p className="max-w-3xl text-sm text-zinc-600">
        Dvipusis ryšys su Scoro: svetainės produktai, užklausos ir pasiūlymai keliauja į Scoro, o Scoro pasiūlymai ir kainos – į svetainę.
        Kiekvieną kryptį įjunkite atskirai. Kol jungikliai išjungti, į Scoro niekas nesiunčiama.
      </p>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl bg-white p-5 shadow-sm">
            <p className="text-sm text-zinc-500">{s.label}</p>
            <p className="text-lg font-semibold">{s.value}</p>
          </div>
        ))}
      </div>
      <ScoroPanel
        settings={{
          subdomain: c.subdomain,
          companyAccountId: c.companyAccountId,
          hasKey: Boolean(c.apiKey),
          lang: c.lang,
          priceListId: c.priceListId,
          domainToken: c.domainToken,
          pushProducts: c.pushProducts,
          overwriteExisting: c.overwriteExisting,
          pushLeads: c.pushLeads,
          pushQuotes: c.pushQuotes,
          pullQuotes: c.pullQuotes,
          enrichQuotes: c.enrichQuotes,
          pullPrices: c.pullPrices,
        }}
        webhookUrl={c.webhookSecret ? `${site}/api/scoro/webhook?token=${c.webhookSecret}` : "išsaugokite nustatymus – adresas bus sugeneruotas"}
        domainUrl={`${site}/scoro.txt`}
      />
      {failedTasks.length > 0 && (
        <Card title="Nepavykusios užduotys">
          <ul className="space-y-1 text-sm">
            {failedTasks.map((t) => (
              <li key={t.id}>
                <Badge tone="amber">{t.kind}</Badge> {t.attempts} band. – <span className="text-zinc-600">{t.lastError}</span>
              </li>
            ))}
          </ul>
          <form action={retryScoroTasks} className="mt-3">
            <button className="text-sm underline">Bandyti dar kartą</button>
          </form>
        </Card>
      )}
      <Card title="Žurnalas" className="p-0">
        <table className="w-full text-sm">
          <tbody>
            {logs.map((l) => (
              <tr key={l.id} className="border-t border-zinc-100 first:border-t-0">
                <td className="whitespace-nowrap px-5 py-2 text-zinc-500">{l.createdAt.toLocaleString("lt-LT")}</td>
                <td className="px-5 py-2"><Badge tone={l.ok ? (l.direction === "in" ? "blue" : "green") : "amber"}>{l.direction === "in" ? "← Scoro" : "→ Scoro"} {l.kind}</Badge></td>
                <td className="px-5 py-2 text-zinc-700">{l.message}</td>
              </tr>
            ))}
            {logs.length === 0 && <tr><td className="p-5 text-zinc-500">Įrašų dar nėra.</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
