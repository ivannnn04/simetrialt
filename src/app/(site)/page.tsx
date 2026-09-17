import Link from "next/link";
import { db } from "@/lib/db";
import { formatPrice } from "@/lib/slug";
import { CmsContent } from "@/components/SiteChrome";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [homePage, featured] = await Promise.all([
    db.page.findFirst({ where: { slug: "home", published: true } }),
    db.product.findMany({
      where: { published: true },
      orderBy: { updatedAt: "desc" },
      take: 6,
      include: { images: { orderBy: { sort: "asc" }, take: 1 } },
    }),
  ]);

  return (
    <div className="space-y-12">
      <section>
        <h1 className="mb-4 text-3xl font-semibold tracking-tight">
          {homePage?.title ?? "Simetria LT"}
        </h1>
        {homePage ? (
          <CmsContent content={homePage.content} />
        ) : (
          <p className="text-zinc-600">
            Sveiki atvykę! Turinį galite redaguoti administratoriaus aplinkoje
            sukūrę puslapį su nuoroda „home“.
          </p>
        )}
      </section>

      {featured.length > 0 && (
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Katalogas</h2>
            <Link href="/catalogue" className="text-sm hover:underline">
              Visi produktai →
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            {featured.map((p) => (
              <Link
                key={p.id}
                href={`/catalogue/${p.slug}`}
                className="overflow-hidden rounded-xl bg-white shadow-sm hover:shadow"
              >
                {p.images[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.images[0].url} alt={p.images[0].alt} className="aspect-square w-full object-cover" />
                ) : (
                  <div className="flex aspect-square items-center justify-center bg-zinc-100 text-zinc-400">
                    Nėra nuotraukos
                  </div>
                )}
                <div className="p-3">
                  <p className="font-medium">{p.name}</p>
                  <p className="text-sm text-zinc-500">{formatPrice(p.priceCents, p.currency)}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
