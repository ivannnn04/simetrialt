import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { LOGO_PNG_DATA_URL, LOGO_PNG_SIZE } from "@/data/logo-png";
import type { Dictionary } from "@/i18n/dictionaries";

export type AlbumPdfLabels = Dictionary["album"]["pdfDoc"];

export type AlbumPdfRow = {
  name: string;
  category: string;
  brand: string;
  quantity: number;
  unitCents: number;
  note: string;
};

/** Products of one album section; an empty name = no heading (album without sections). */
export type AlbumPdfGroup = { name: string; note: string; rows: AlbumPdfRow[] };

export type AlbumPdfInput = {
  collectionName: string;
  reference: string;
  customer?: { name: string; email: string } | null;
  /** all products without sections (used when `groups` is not given) */
  rows?: AlbumPdfRow[];
  /** products by section, in order, each under its name and note */
  groups?: AlbumPdfGroup[];
  /** general notes about the project, printed above the products */
  note?: string;
  labels: AlbumPdfLabels;
};

const INK = "#282828";
const BODY = "#6e6e6e";
const SECONDARY = "#898989";
const LINE = "#d9d9d9";
const LIGHT = "#f2f2f2";
const CREAM = "#f9f8f4";

const eur = (cents: number) =>
  `EUR ${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Liberation Sans (Helvetica metrics) subset with Lithuanian diacritics; jsPDF's built-in fonts only cover Latin-1. */
const FONT = "LiberationSans";

async function fontBase64(file: string): Promise<string> {
  const res = await fetch(`/fonts/${file}`);
  if (!res.ok) throw new Error(`font ${file}: ${res.status}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

/** Registers the regular and bold faces; falls back to helvetica if the files cannot be fetched. */
async function registerFont(doc: jsPDF): Promise<string> {
  try {
    const [regular, bold] = await Promise.all([fontBase64("LiberationSans-Regular.ttf"), fontBase64("LiberationSans-Bold.ttf")]);
    doc.addFileToVFS("LiberationSans-Regular.ttf", regular);
    doc.addFont("LiberationSans-Regular.ttf", FONT, "normal");
    doc.addFileToVFS("LiberationSans-Bold.ttf", bold);
    doc.addFont("LiberationSans-Bold.ttf", FONT, "bold");
    return FONT;
  } catch (e) {
    console.error("album pdf: font unavailable, falling back to helvetica", e);
    return "helvetica";
  }
}

/** Tints the header wordmark PNG (logo = alpha channel) with the wanted colour and returns a PNG data URL. */
async function logoPng(color: string): Promise<string> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = reject;
    el.src = LOGO_PNG_DATA_URL;
  });
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas unavailable");
  ctx.drawImage(img, 0, 0);
  ctx.globalCompositeOperation = "source-in";
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
}

/**
 * Builds the album as an invoice-style A4 "indicative quotation" and triggers the download:
 * letterhead, client / document details, a line-item table and a totals block.
 */
export async function downloadAlbumPdf(input: AlbumPdfInput) {
  const L = input.labels;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const font = await registerFont(doc);
  const W = doc.internal.pageSize.getWidth();
  const M = 20;
  const today = new Date();
  const fmtDate = (d: Date) => d.toLocaleDateString(L.locale, { day: "2-digit", month: "long", year: "numeric" });
  const dateText = fmtDate(today);

  // Letterhead
  doc.setFillColor(CREAM);
  doc.rect(0, 0, W, 42, "F");
  // header wordmark, 40mm wide, vertically centred in the band
  const logoW = 40;
  const logoH = (logoW * LOGO_PNG_SIZE.height) / LOGO_PNG_SIZE.width;
  try {
    doc.addImage(await logoPng(INK), "PNG", M, 21 - logoH / 2, logoW, logoH);
  } catch {
    doc.setTextColor(INK);
    doc.setFont(font, "bold");
    doc.setFontSize(22);
    doc.text("simetria", M, 22);
  }
  doc.setFont(font, "normal");
  doc.setFontSize(9);
  doc.setTextColor(BODY);
  doc.text([...L.letterhead], W - M, 15, { align: "right" });

  // Title
  doc.setTextColor(INK);
  doc.setFont(font, "bold");
  doc.setFontSize(20);
  doc.text(L.title, M, 58);
  doc.setFont(font, "normal");
  doc.setFontSize(11);
  doc.setTextColor(BODY);
  doc.text(input.collectionName, M, 65);

  // Details columns
  const details: [string, string][] = [
    [L.reference, input.reference],
    [L.date, dateText],
    [L.validUntil, fmtDate(new Date(today.getTime() + 30 * 86400000))],
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
  doc.text(L.preparedFor, M, 80);
  doc.setTextColor(INK);
  doc.setFontSize(11);
  doc.text(input.customer?.name ?? L.guest, M, 86);
  doc.setFontSize(9);
  doc.setTextColor(BODY);
  if (input.customer?.email) doc.text(input.customer.email, M, 91);

  // General notes about the project (a one-cell table so a long text continues on the next page)
  let startY = 100;
  const note = input.note?.trim();
  if (note) {
    autoTable(doc, {
      startY,
      margin: { left: M, right: M },
      head: [[L.notes]],
      body: [[note]],
      styles: { font, fontSize: 9, textColor: INK, cellPadding: { top: 2, right: 4, bottom: 4, left: 4 }, lineWidth: 0 },
      headStyles: { fillColor: CREAM, textColor: SECONDARY, fontStyle: "normal", fontSize: 8, cellPadding: { top: 4, right: 4, bottom: 1, left: 4 } },
      bodyStyles: { fillColor: CREAM },
    });
    startY = ((doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? startY) + 8;
  }

  // Line items, grouped by section: a heading row with the section subtotal, its note, then the products
  const groups: AlbumPdfGroup[] = input.groups ?? [{ name: "", note: "", rows: input.rows ?? [] }];
  const rows = groups.flatMap((g) => g.rows);
  const units = rows.reduce((n, r) => n + r.quantity, 0);
  const subtotal = rows.reduce((n, r) => n + r.unitCents * r.quantity, 0);
  type Cell = string | { content: string; colSpan?: number; styles?: Record<string, unknown> };
  const body: Cell[][] = [];
  const kinds: ("row" | "noted" | "section" | "note")[] = [];
  let n = 0;
  for (const g of groups) {
    if (g.name) {
      const sum = g.rows.reduce((t, r) => t + r.unitCents * r.quantity, 0);
      body.push([
        { content: g.name, colSpan: 5, styles: { fontStyle: "bold", fontSize: 11, fillColor: CREAM, cellPadding: { top: 5, right: 3, bottom: 3, left: 3 } } },
        { content: g.rows.length ? `${L.subtotal}  ${eur(sum)}` : "", colSpan: 2, styles: { halign: "right", fontStyle: "bold", fillColor: CREAM, cellPadding: { top: 5, right: 3, bottom: 3, left: 3 } } },
      ]);
      kinds.push("section");
      if (g.note.trim()) {
        body.push([{ content: g.note.trim(), colSpan: 7, styles: { textColor: BODY, fontStyle: "normal", fillColor: CREAM, cellPadding: { top: 0, right: 3, bottom: 4, left: 3 } } }]);
        kinds.push("note");
      }
    }
    for (const r of g.rows) {
      n += 1;
      body.push([String(n), r.note ? `${r.name}\n${r.note}` : r.name, r.category, r.brand, String(r.quantity), eur(r.unitCents), eur(r.unitCents * r.quantity)]);
      kinds.push(r.note ? "noted" : "row");
    }
  }
  autoTable(doc, {
    startY,
    margin: { left: M, right: M },
    head: [[...L.columns]],
    body: body as never,
    styles: { font, fontSize: 9, textColor: INK, cellPadding: 3, lineColor: LINE, lineWidth: { bottom: 0.2 } },
    headStyles: { fillColor: LIGHT, textColor: INK, fontStyle: "bold", lineWidth: 0 },
    columnStyles: {
      0: { cellWidth: 8, textColor: SECONDARY },
      4: { halign: "right", cellWidth: 16 },
      5: { halign: "right", cellWidth: 28 },
      6: { halign: "right", cellWidth: 30 },
    },
    didParseCell: (data) => {
      if (data.section !== "body") return;
      const kind = kinds[data.row.index];
      // a section heading and its note read as one block
      if (kind === "section" && kinds[data.row.index + 1] === "note") data.cell.styles.lineWidth = 0;
      if (kind === "section" || kind === "note") data.cell.styles.textColor = kind === "note" ? BODY : INK;
    },
  });

  // Totals
  const afterTable = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 120;
  let y = afterTable + 10;
  const totals: [string, string, boolean][] = [
    [L.products, String(rows.length), false],
    [L.units, String(units), false],
    [L.total, `${L.from} ${eur(subtotal)}`, true],
  ];
  const boxX = W - M - 100;
  totals.forEach(([k, v, strong]) => {
    doc.setFont(font, strong ? "bold" : "normal");
    doc.setFontSize(strong ? 11 : 9);
    doc.setTextColor(strong ? INK : BODY);
    doc.text(k, boxX, y);
    doc.setTextColor(INK);
    doc.text(v, W - M, y, { align: "right" });
    doc.setDrawColor(LINE);
    doc.line(boxX, y + 2.5, W - M, y + 2.5);
    y += 8;
  });

  // Footnote (on a new page when it would run into the page footer)
  const footnote = doc.splitTextToSize(L.footnote, W - 2 * M);
  if (y + 6 + footnote.length * 4 > doc.internal.pageSize.getHeight() - 16) {
    doc.addPage();
    y = 14;
  }
  doc.setFont(font, "normal");
  doc.setFontSize(8);
  doc.setTextColor(SECONDARY);
  doc.text(footnote, M, y + 6);

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setTextColor(SECONDARY);
    doc.text(`© ${today.getFullYear()} Simetria  ·  ${L.page(p, pages)}`, W / 2, doc.internal.pageSize.getHeight() - 10, { align: "center" });
  }

  // strip diacritics so "Viešbučio" becomes "viesbucio" rather than losing letters
  const slug = input.collectionName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const file = `simetria-${slug || "collection"}.pdf`;
  doc.save(file);
}
