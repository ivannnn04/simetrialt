"use server";

import { after } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { currentCustomer } from "@/lib/customer-auth";
import { emailNewLead } from "@/lib/notifications";
import { enqueue, runSync, wantsPush } from "@/lib/scoro/sync";
import { formatPrice } from "@/lib/slug";

const Input = z.object({
  collectionName: z.string().max(200),
  items: z
    .array(z.object({ productId: z.string().max(100), quantity: z.number().int().min(1).max(9999), note: z.string().max(1000) }))
    .min(1)
    .max(300),
});

/**
 * "Send as enquiry" on a collection: the signed-in client's products, quantities and notes become one
 * CRM inquiry (prices taken from the catalogue, not from the browser). The team sees it in the admin
 * notifications and gets it by e-mail.
 */
export async function sendCollectionEnquiry(input: z.infer<typeof Input>): Promise<{ ok?: true; error?: "login" | "empty" | "failed" }> {
  const customer = await currentCustomer();
  if (!customer) return { error: "login" };
  const parsed = Input.safeParse(input);
  if (!parsed.success) return { error: "empty" };
  const { collectionName, items } = parsed.data;
  try {
    const products = await db.product.findMany({ where: { id: { in: items.map((i) => i.productId) } } });
    const byId = new Map(products.map((p) => [p.id, p]));
    const lines = items.filter((i) => byId.has(i.productId));
    if (!lines.length) return { error: "empty" };
    let total = 0;
    const text = lines.map((i, n) => {
      const p = byId.get(i.productId)!;
      const unit = p.salePriceCents != null && p.salePriceCents < p.priceCents ? p.salePriceCents : p.priceCents;
      total += unit * i.quantity;
      return [
        `${n + 1}. ${p.name}${p.brand ? ` (${p.brand})` : ""}`,
        `   Kodas: ${p.sku || "—"} · Kiekis: ${i.quantity} · Kaina: ${unit ? formatPrice(unit, p.currency) : "—"}`,
        i.note.trim() ? `   Pastaba: ${i.note.trim()}` : "",
      ]
        .filter(Boolean)
        .join("\n");
    });
    const units = lines.reduce((s, i) => s + i.quantity, 0);
    const message = [
      `Kolekcija „${collectionName || "Be pavadinimo"}“ – ${lines.length} produkt., ${units} vnt.`,
      "",
      ...text,
      "",
      `Orientacinė suma: ${formatPrice(total, products[0]?.currency ?? "EUR")}`,
    ].join("\n");
    const lead = await db.lead.create({
      data: {
        name: customer.name,
        email: customer.email,
        company: customer.company,
        message,
        source: "website",
        productSku: lines.length === 1 ? byId.get(lines[0].productId)!.sku : null,
      },
    });
    after(() => emailNewLead(lead.id).catch((e) => console.error("lead e-mail failed", e)));
    if (await wantsPush("lead").catch(() => false)) {
      await enqueue("lead", lead.id);
      after(() => runSync(20_000).catch(() => undefined));
    }
    return { ok: true };
  } catch (e) {
    console.error("collection enquiry failed", e);
    return { error: "failed" };
  }
}
