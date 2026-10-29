import { type NextRequest } from "next/server";
import { currentUser } from "@/lib/auth";
import { DOC, type DocType } from "@/lib/erp/config";
import { listDocuments, userNames } from "@/lib/erp/queries";
import { fmtDate } from "@/lib/erp/money";

export const dynamic = "force-dynamic";

/** CSV of a document list with the same filters as the screen (Excel-friendly: BOM + semicolons). */
export async function GET(req: NextRequest) {
  const me = await currentUser();
  if (!me || !["ADMIN", "EDITOR"].includes(me.role)) return new Response("Forbidden", { status: 403 });
  const sp = req.nextUrl.searchParams;
  const kind = sp.get("kind") ?? "offers";
  const f = { q: sp.get("q") ?? undefined, status: sp.getAll("status"), manager: sp.get("manager") ?? undefined, from: sp.get("from") ?? undefined, to: sp.get("to") ?? undefined, type: sp.get("type") ?? undefined };
  const [{ docs }, users] = await Promise.all([listDocuments(kind, f, 5000), userNames()]);
  const money = (c: number) => (c / 100).toFixed(2).replace(".", ",");
  const esc = (v: string) => (/[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const head = ["Tipas", "Nr.", "Data", "Terminas", "Klientas", "Tiekėjas", "Architektas / partneris", "Kanalas", "Būsena", "Vadybininkas", "Suma be PVM", "PVM", "Suma su PVM", "Savikaina", "Marža", "Apmokėta", "Liko"];
  const rows = docs.map((d) => [
    DOC[d.type as DocType].label,
    d.number,
    fmtDate(d.date),
    fmtDate(d.dueDate ?? d.validUntil),
    d.client?.name ?? "",
    d.supplier?.name ?? "",
    d.party?.name ?? "",
    d.channel,
    d.status,
    d.managerId ? (users[d.managerId] ?? "") : "",
    money(d.t.net),
    money(d.t.vat),
    money(d.t.total),
    money(d.t.cost),
    money(d.t.margin),
    money(d.paid),
    money(d.open),
  ]);
  const csv = "﻿" + [head, ...rows].map((r) => r.map((c) => esc(String(c))).join(";")).join("\r\n");
  return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${kind}-${fmtDate(new Date())}.csv"` } });
}
