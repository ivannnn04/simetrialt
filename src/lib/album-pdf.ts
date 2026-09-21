import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export type AlbumPdfRow = {
  name: string;
  category: string;
  brand: string;
  quantity: number;
  unitCents: number;
  note: string;
};

export type AlbumPdfInput = {
  collectionName: string;
  reference: string;
  customer?: { name: string; email: string } | null;
  rows: AlbumPdfRow[];
};

const INK = "#282828";
const BODY = "#6e6e6e";
const SECONDARY = "#898989";
const LINE = "#d9d9d9";
const LIGHT = "#f2f2f2";
const CREAM = "#f9f8f4";

const eur = (cents: number) =>
  `EUR ${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Builds the album as an invoice-style A4 "indicative quotation" and triggers the download:
 * letterhead, client / document details, a line-item table and a totals block.
 */
export function downloadAlbumPdf(input: AlbumPdfInput) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const M = 20;
  const today = new Date();
  const dateText = today.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });

  // Letterhead
  doc.setFillColor(CREAM);
  doc.rect(0, 0, W, 42, "F");
  doc.setTextColor(INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("simetria", M, 22);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(BODY);
  doc.text(["Simetria Showroom", "Vilnius, Lithuania", "info@simetria.com  ·  (000) 666 555 444"], W - M, 15, { align: "right" });

  // Title
  doc.setTextColor(INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("Indicative quotation", M, 58);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(BODY);
  doc.text(input.collectionName, M, 65);

  // Details columns
  const details: [string, string][] = [
    ["Reference", input.reference],
    ["Date", dateText],
    ["Valid until", new Date(today.getTime() + 30 * 86400000).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })],
  ];
  doc.setFontSize(9);
  details.forEach(([k, v], i) => {
    const y = 58 + i * 5.5;
    doc.setTextColor(SECONDARY);
    doc.text(k, W - M - 60, y);
    doc.setTextColor(INK);
    doc.text(v, W - M, y, { align: "right" });
  });

  doc.setTextColor(SECONDARY);
  doc.text("Prepared for", M, 80);
  doc.setTextColor(INK);
  doc.setFontSize(11);
  doc.text(input.customer?.name ?? "Guest", M, 86);
  doc.setFontSize(9);
  doc.setTextColor(BODY);
  if (input.customer?.email) doc.text(input.customer.email, M, 91);

  // Line items
  const units = input.rows.reduce((n, r) => n + r.quantity, 0);
  const subtotal = input.rows.reduce((n, r) => n + r.unitCents * r.quantity, 0);
  autoTable(doc, {
    startY: 100,
    margin: { left: M, right: M },
    head: [["#", "Product", "Category", "Brand", "Qty", "Unit price", "Amount"]],
    body: input.rows.map((r, i) => [
      String(i + 1),
      r.note ? `${r.name}\n${r.note}` : r.name,
      r.category,
      r.brand,
      String(r.quantity),
      eur(r.unitCents),
      eur(r.unitCents * r.quantity),
    ]),
    styles: { font: "helvetica", fontSize: 9, textColor: INK, cellPadding: 3, lineColor: LINE, lineWidth: { bottom: 0.2 } },
    headStyles: { fillColor: LIGHT, textColor: INK, fontStyle: "bold", lineWidth: 0 },
    columnStyles: {
      0: { cellWidth: 8, textColor: SECONDARY },
      4: { halign: "right", cellWidth: 12 },
      5: { halign: "right", cellWidth: 28 },
      6: { halign: "right", cellWidth: 30 },
    },
    didParseCell: (data) => {
      // notes render in grey under the product name
      if (data.section === "body" && data.column.index === 1 && input.rows[data.row.index]?.note) {
        data.cell.styles.textColor = INK;
      }
    },
  });

  // Totals
  const afterTable = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 120;
  let y = afterTable + 10;
  const totals: [string, string, boolean][] = [
    ["Products", String(input.rows.length), false],
    ["Total units", String(units), false],
    ["Indicative total", `from ${eur(subtotal)}`, true],
  ];
  const boxX = W - M - 80;
  totals.forEach(([k, v, strong]) => {
    doc.setFont("helvetica", strong ? "bold" : "normal");
    doc.setFontSize(strong ? 11 : 9);
    doc.setTextColor(strong ? INK : BODY);
    doc.text(k, boxX, y);
    doc.setTextColor(INK);
    doc.text(v, W - M, y, { align: "right" });
    doc.setDrawColor(LINE);
    doc.line(boxX, y + 2.5, W - M, y + 2.5);
    y += 8;
  });

  // Footnote
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(SECONDARY);
  doc.text(
    doc.splitTextToSize(
      "Prices are indicative and subject to confirmation. Volume discounts may apply - our team will confirm on enquiry. This document is not an invoice.",
      W - 2 * M
    ),
    M,
    y + 6
  );

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setTextColor(SECONDARY);
    doc.text(`© ${today.getFullYear()} Simetria  ·  Page ${p} of ${pages}`, W / 2, doc.internal.pageSize.getHeight() - 10, { align: "center" });
  }

  const file = `simetria-${input.collectionName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "collection"}.pdf`;
  doc.save(file);
}
