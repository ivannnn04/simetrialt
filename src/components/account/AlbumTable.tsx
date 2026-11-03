"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "@/components/ui/Link";
import {
  addSection,
  deleteSection,
  moveItemToSection,
  moveSection,
  removeFromAlbum,
  setAlbumNote,
  updateAlbumItem,
  updateSection,
  type AlbumSection,
} from "@/lib/albums-store";
import { AutoNote } from "@/components/account/AutoNote";
import { sendCollectionEnquiry } from "@/actions/collection-enquiry";
import {
  ProductCard,
  type ProductCardData,
} from "@/components/catalogue/ProductCard";
import { cn } from "@/lib/cn";
import { useContacts, useT } from "@/i18n/client";
import { term } from "@/i18n/dictionaries";

export type AlbumRow = {
  productId: string;
  name: string;
  category: string;
  /** two-line category label as in the design, e.g. ["Indoor", "lighting"] */
  categoryLines: [string, string];
  brand: string;
  priceCents: number;
  quantity: number;
  note: string;
  href: string;
  image: string | null;
  card: ProductCardData;
  /** section of the album the product is in; missing = unsorted */
  sectionId?: string;
};

type Props = {
  collectionId: string;
  collectionName: string;
  customer?: { name: string; email: string } | null;
  rows: AlbumRow[];
  /** sample albums are not in the store: quantity / note changes stay in local state */
  readOnly?: boolean;
  /** customer-made sections (rooms, floors…) of the album, in order */
  sections?: AlbumSection[];
  /** general notes about the project */
  note?: string;
};

type Group = { section: AlbumSection | null; rows: AlbumRow[] };

const eur = (cents: number) =>
  `€${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

const SORTS = ["category", "name", "price", "brand"] as const;
type Sort = (typeof SORTS)[number];

function Icon({
  d,
  className,
  size = 24,
}: {
  d: string;
  className?: string;
  size?: number;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={cn("size-6", className)}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <path
        d={d}
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const MINUS = "M6 12h12";
const PLUS = "M6 12h12M12 6v12";
const CLOSE = "M7 7l10 10M17 7L7 17";
const LIST = "M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01";
const GRID = "M4 4h16v16H4zM9.5 4v16M14.5 4v16";
const UP = "M7 14l5-5 5 5";
const DOWN = "M7 10l5 5 5-5";

/** Album page body: toolbar, product table (or card grid) and the collection summary. */
export function AlbumTable({
  collectionId,
  collectionName,
  customer,
  rows: initial,
  readOnly = false,
  sections = [],
  note = "",
}: Props) {
  const t = useT();
  const site = useContacts();
  const a = t.album;
  const [localRows, setLocalRows] = useState(initial);
  // Real albums re-render from the store; sample albums keep their edits in local state only.
  const rows = readOnly ? localRows : initial;
  const [sort, setSort] = useState<Sort>("category");
  const [view, setView] = useState<"list" | "grid">("list");

  const sorted = useMemo(() => {
    const list = [...rows];
    switch (sort) {
      case "name":
        return list.sort((a, b) => a.name.localeCompare(b.name));
      case "price":
        return list.sort((a, b) => a.priceCents - b.priceCents);
      case "brand":
        return list.sort((a, b) => a.brand.localeCompare(b.brand));
      default:
        return list.sort((a, b) => a.category.localeCompare(b.category));
    }
  }, [rows, sort]);

  // Products grouped by section (in the customer's order), unsorted ones last. Without sections
  // there is one group without a header, so the page looks as before.
  const groups: Group[] = useMemo(() => {
    if (!sections.length) return [{ section: null, rows: sorted }];
    const ids = new Set(sections.map((s) => s.id));
    const out: Group[] = sections.map((s) => ({ section: s, rows: sorted.filter((r) => r.sectionId === s.id) }));
    const unsorted = sorted.filter((r) => !r.sectionId || !ids.has(r.sectionId));
    if (unsorted.length) out.push({ section: null, rows: unsorted });
    return out;
  }, [sections, sorted]);
  const [focusSection, setFocusSection] = useState<string | null>(null);
  const newSection = () => {
    const id = addSection(collectionId, a.sections.defaultName(sections.length + 1));
    if (id) setFocusSection(id);
  };

  const patch = (productId: string, p: { quantity?: number; note?: string }) => {
    if (readOnly) setLocalRows((rs) => rs.map((r) => (r.productId === productId ? { ...r, ...p } : r)));
    else updateAlbumItem(collectionId, productId, p);
  };
  const remove = (productId: string) => {
    if (readOnly) setLocalRows((rs) => rs.filter((r) => r.productId !== productId));
    else removeFromAlbum(collectionId, productId);
  };

  const [enquiry, setEnquiry] = useState<"idle" | "sending" | "sent" | "failed" | "login">("idle");
  const sendEnquiry = async () => {
    setEnquiry("sending");
    try {
      const res = await sendCollectionEnquiry({
        collectionName,
        note,
        sections: sections.map((s) => ({ id: s.id, name: s.name, note: s.note })),
        items: groups.flatMap((g) =>
          g.rows.map((r) => ({ productId: r.productId, quantity: Math.max(1, r.quantity), note: r.note ?? "", sectionId: g.section?.id ?? null })),
        ),
      });
      setEnquiry(res.ok ? "sent" : res.error === "login" ? "login" : "failed");
    } catch {
      setEnquiry("failed");
    }
  };

  const [exporting, setExporting] = useState(false);
  const exportPdf = async () => {
    setExporting(true);
    try {
      const { downloadAlbumPdf } = await import("@/lib/album-pdf");
      await downloadAlbumPdf({
        collectionName,
        reference: `SIM-${new Date().toISOString().slice(2, 10).replace(/-/g, "")}-${collectionId
          .replace(/[^a-z0-9]/gi, "")
          .slice(-4)
          .toUpperCase()}`,
        customer,
        labels: { ...a.pdfDoc, letterhead: [a.pdfDoc.letterhead[0], a.pdfDoc.letterhead[1], `${site.email}  ·  ${site.phone}`] },
        note,
        groups: groups.map((g) => ({
          name: g.section ? g.section.name : sections.length ? a.pdfDoc.unsorted : "",
          note: g.section?.note ?? "",
          rows: g.rows.map((r) => ({
            name: r.name,
            category: term(t, r.category),
            brand: r.brand,
            quantity: r.quantity,
            unitCents: r.priceCents,
            note: r.note,
          })),
        })),
      });
    } finally {
      setExporting(false);
    }
  };

  const units = rows.reduce((n, r) => n + r.quantity, 0);
  const brands = new Set(rows.map((r) => r.brand).filter(Boolean)).size;
  const total = rows.reduce((n, r) => n + r.priceCents * r.quantity, 0);

  const th =
    "bg-[#f2f2f2] p-[10px] text-[20px] font-medium leading-[1.3] tracking-[-0.04em] text-[#1b2a41]";
  const td = "border-b border-[#ddd] py-5 align-top";
  const cell =
    "px-[10px] text-[18px] leading-[1.3] tracking-[-0.04em] text-[#1b2a41]";

  const canSection = !readOnly && sections.length > 0;
  const sectionSelect = (r: AlbumRow, className?: string) =>
    canSection && (
      <label className={cn("flex items-center gap-2 text-[13px] leading-none tracking-[-0.02em]", className)}>
        <span className="shrink-0 text-secondary">{a.sections.select}</span>
        <select
          value={r.sectionId && sections.some((s) => s.id === r.sectionId) ? r.sectionId : ""}
          aria-label={a.sections.selectFor(r.name)}
          onChange={(e) => moveItemToSection(collectionId, r.productId, e.target.value || null)}
          className="h-[30px] min-w-0 max-w-full flex-1 truncate border border-[#ddd] bg-transparent px-2 text-[13px] text-[#1b2a41] focus:border-dark focus:outline-none"
        >
          <option value="">{a.sections.unsorted}</option>
          {sections.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
    );

  const tableHead = (
    <thead>
      <tr>
        <th className={cn(th, "pl-5 text-left")}>{a.columns.product}</th>
        <th className={cn(th, "text-left")}>{a.columns.category}</th>
        <th className={cn(th, "text-left")}>{a.columns.price}</th>
        <th className={cn(th, "text-left")}>{a.columns.qty}</th>
        <th className={cn(th, "text-left")}>{a.columns.notes}</th>
        <th className={cn(th, "pr-5 text-left")}>{a.columns.actions}</th>
      </tr>
      <tr aria-hidden>
        <td colSpan={6} className="h-[44px]" />
      </tr>
    </thead>
  );

  const table = (list: AlbumRow[], head: boolean, emptyText: string) => (
    <div className="w-full overflow-x-auto">
      <table className="w-full min-w-[900px] table-fixed border-separate border-spacing-0">
        <colgroup>
          <col />
          <col className="w-[116px] xl:w-[140px]" />
          <col className="w-[116px] xl:w-[140px]" />
          <col className="w-[116px] xl:w-[140px]" />
          <col className="w-[116px] xl:w-[140px]" />
          <col className="w-[116px] xl:w-[140px]" />
        </colgroup>
        {head && tableHead}
        <tbody>
          {list.map((r) => (
            <tr key={r.productId}>
              <td className={cn(td, "pl-5 pr-6")}>
                <div className="flex items-start gap-[25px]">
                  <Link href={r.href} tabIndex={-1} aria-hidden className="flex size-[114px] shrink-0 items-center justify-center bg-[#f2f2f2]">
                    {r.image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.image} alt="" className="max-h-[60%] max-w-[80%] object-contain" />
                    )}
                  </Link>
                  <div className="flex min-w-0 flex-1 flex-col gap-3 leading-none">
                    <Link href={r.href} className="text-[18px] font-semibold tracking-[-0.04em] text-[#1b2a41] transition-colors hover:text-accent">
                      {r.name}
                    </Link>
                    <span className="text-[13px] tracking-[-0.04em] text-[#bcbcbc]">{term(t, r.category)}</span>
                    {sectionSelect(r, "mt-2 max-w-[260px]")}
                  </div>
                </div>
              </td>
              <td className={cn(td, cell)}>
                <span className="block">{r.categoryLines[0]}</span>
                <span className="block">{term(t, r.categoryLines[1])}</span>
              </td>
              <td className={cn(td, cell)}>
                <span className="block">{a.from}</span>
                <span className="block">{eur(r.priceCents)}</span>
              </td>
              <td className={td}>
                <div className="flex h-[45px] items-center gap-2">
                  <button
                    type="button"
                    aria-label={a.decrease}
                    onClick={() => patch(r.productId, { quantity: Math.max(1, r.quantity - 1) })}
                    className="text-ink transition-colors hover:text-accent"
                  >
                    <Icon d={MINUS} />
                  </button>
                  <span className="w-[31px] p-[10px] text-center text-[18px] leading-[1.3] tracking-[-0.04em] text-[#1b2a41]">{r.quantity}</span>
                  <button
                    type="button"
                    aria-label={a.increase}
                    onClick={() => patch(r.productId, { quantity: r.quantity + 1 })}
                    className="text-ink transition-colors hover:text-accent"
                  >
                    <Icon d={PLUS} />
                  </button>
                </div>
              </td>
              <td className={td}>
                <input
                  defaultValue={r.note}
                  placeholder={a.note}
                  aria-label={a.noteFor(r.name)}
                  onBlur={(e) => e.target.value !== r.note && patch(r.productId, { note: e.target.value })}
                  className="h-[45px] w-full border border-[#ddd] bg-transparent px-[10px] text-center text-[18px] tracking-[-0.04em] text-[#1b2a41] placeholder:text-[16px] placeholder:text-secondary focus:border-dark focus:outline-none"
                />
              </td>
              <td className={cn(td, "pl-[10px] pr-5")}>
                <div className="flex h-[45px] items-center justify-center gap-2">
                  <Link href={r.href} className="whitespace-nowrap text-[18px] leading-[1.3] tracking-[-0.04em] text-[#1b2a41] transition-colors hover:text-accent">
                    {a.view}
                  </Link>
                  <button type="button" aria-label={a.remove(r.name)} onClick={() => remove(r.productId)} className="text-ink transition-colors hover:text-[#fb3b30]">
                    <Icon d={CLOSE} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {list.length === 0 && (
            <tr>
              <td colSpan={6} className="py-10 text-[16px] tracking-[-0.04em] text-secondary">
                {emptyText}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  const grid = (list: AlbumRow[], emptyText: string) => (
    /* Grid layout (Figma 4217:47128): cards with filled hearts next to the summary panel */
    <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {list.map((r) => (
        <div key={r.productId} className="flex min-w-0 flex-col gap-2">
          <ProductCard product={{ ...r.card, saved: true }} className="h-[420px] xl:h-[449px]" />
          {sectionSelect(r)}
        </div>
      ))}
      {list.length === 0 && <p className="text-[16px] tracking-[-0.04em] text-secondary md:col-span-2 xl:col-span-3">{emptyText}</p>}
    </div>
  );

  return (
    <div className="flex w-full flex-col gap-[45px]">
      {!readOnly && (
        <div className="flex flex-col gap-3">
          <h2 className="text-[20px] font-medium leading-[1.3] tracking-[-0.04em] text-[#1b2a41]">{a.projectNote.title}</h2>
          <AutoNote
            key={collectionId}
            value={note}
            label={a.projectNote.title}
            placeholder={a.projectNote.placeholder}
            onSave={(v) => setAlbumNote(collectionId, v)}
          />
          {!sections.length && <p className="text-[15px] leading-[1.4] tracking-[-0.02em] text-secondary">{a.sections.hint}</p>}
        </div>
      )}

      {/* toolbar (node 4217:46945) */}
      <div className="flex flex-col gap-4 md:min-h-[39px] md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-6 md:gap-9">
          <p className="text-[18px] font-semibold leading-none tracking-[-0.04em] text-[#2b2b2b]">
            {a.count(rows.length)}
          </p>
          <label className="flex items-center gap-2 text-[15px] leading-[1.4] tracking-[-0.04em]">
            <span className="text-[#1a1c18]/60">{a.sortBy}</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              className="bg-transparent text-[#1a1c18] focus:outline-none"
            >
              {SORTS.map((s) => (
                <option key={s} value={s}>
                  {a.sorts[s]}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label={a.listView}
              aria-pressed={view === "list"}
              onClick={() => setView("list")}
              className={cn(
                "flex size-[33px] items-center justify-center transition-colors",
                view === "list" ? "text-ink" : "text-tertiary hover:text-ink",
              )}
            >
              <Icon d={LIST} size={26} />
            </button>
            <button
              type="button"
              aria-label={a.gridView}
              aria-pressed={view === "grid"}
              onClick={() => setView("grid")}
              className={cn(
                "flex size-8 items-center justify-center transition-colors",
                view === "grid" ? "text-ink" : "text-tertiary hover:text-ink",
              )}
            >
              <Icon d={GRID} size={22} />
            </button>
          </div>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          {!readOnly && (
            <button
              type="button"
              onClick={newSection}
              disabled={sections.length >= 50}
              className="flex h-[39px] items-center justify-center gap-[10px] border border-dark px-8 text-[13px] font-medium text-black transition-colors duration-300 hover:bg-dark hover:text-white disabled:opacity-50"
            >
              <Icon d={PLUS} size={16} />
              {a.sections.add}
            </button>
          )}
          <Link
            href="/catalogue"
            className="flex h-[39px] items-center justify-center gap-[10px] bg-dark px-8 text-[13px] font-medium text-white transition-colors duration-300 hover:bg-accent"
          >
            <Icon d={PLUS} size={16} />
            {a.add}
          </Link>
        </div>
      </div>

      <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex w-full min-w-0 flex-col gap-14 lg:flex-1">
          {groups.map((g, gi) => {
            const emptyText = g.section ? a.sections.empty : a.empty;
            return (
              <div key={g.section?.id ?? "unsorted"} className="flex flex-col gap-6">
                {sections.length > 0 && (
                  <SectionHeader
                    collectionId={collectionId}
                    section={g.section}
                    index={g.section ? sections.findIndex((s) => s.id === g.section!.id) : -1}
                    total={sections.length}
                    rows={g.rows}
                    focus={g.section != null && focusSection === g.section.id}
                    onFocused={() => setFocusSection(null)}
                  />
                )}
                {view === "grid" ? grid(g.rows, emptyText) : table(g.rows, gi === 0, emptyText)}
              </div>
            );
          })}
        </div>
          {/* Collection summary (node 4217:47106) */}
          <aside className="flex w-full shrink-0 flex-col gap-12 border border-[#ddd] px-5 py-10 lg:w-[292px]">
            <div className="flex flex-col gap-[18px]">
              <div className="flex flex-col gap-[22px] text-[#1b2a41]">
                <p className="text-[20px] font-medium leading-[1.3] tracking-[-0.04em]">
                  {a.summary.title}
                </p>
                <dl className="flex flex-col text-[18px] tracking-[-0.04em]">
                  {[
                    [a.summary.products, String(rows.length)],
                    [a.summary.units, String(units)],
                    [a.summary.brands, String(brands)],
                  ].map(([k, v], i) => (
                    <div
                      key={k}
                      className={cn(
                        "flex items-center gap-10 border-b border-[#ddd] py-[10px] leading-[1.3]",
                        i === 0 && "border-t",
                      )}
                    >
                      <dt className="flex-1">{k}</dt>
                      <dd className="w-[100px] text-right">{v}</dd>
                    </div>
                  ))}
                  <div className="flex items-center gap-10 py-[10px]">
                    <dt className="flex-1 leading-[1.3]">{a.summary.total}</dt>
                    <dd className="whitespace-nowrap text-right font-semibold leading-none">
                      {a.from} {eur(total)}
                    </dd>
                  </div>
                </dl>
              </div>
              <p className="text-[16px] leading-[1.3] tracking-[-0.04em] text-secondary">
                {a.summary.note}
              </p>
            </div>
            <div className="flex flex-col gap-3">
              {enquiry === "sent" ? (
                <p role="status" className="border border-dark bg-white px-5 py-4 text-[15px] leading-[1.35] tracking-[-0.02em] text-black">
                  {a.summary.sent}
                </p>
              ) : (
                <button
                  type="button"
                  onClick={sendEnquiry}
                  disabled={enquiry === "sending" || rows.length === 0}
                  className="flex h-[39px] items-center justify-center bg-dark px-8 text-[13px] font-medium text-white transition-colors duration-300 hover:bg-accent disabled:opacity-50"
                >
                  {enquiry === "sending" ? a.summary.sending : a.summary.enquiry}
                </button>
              )}
              {enquiry === "failed" && <p role="alert" className="text-[14px] leading-[1.3] text-brand">{a.summary.failed}</p>}
              {enquiry === "login" && (
                <p role="alert" className="text-[14px] leading-[1.3] text-secondary">
                  {a.summary.login}{" "}
                  <Link href={`/account/login?next=${encodeURIComponent(`/account/albums/${collectionId}`)}`} className="text-black underline">
                    {a.summary.signIn}
                  </Link>
                </p>
              )}
              <button
                type="button"
                onClick={exportPdf}
                disabled={exporting}
                className="flex h-[39px] items-center justify-center border border-dark px-8 text-[13px] font-medium text-black transition-colors duration-300 hover:bg-dark hover:text-white disabled:opacity-50"
              >
                {exporting ? a.summary.preparing : a.summary.pdf}
              </button>
            </div>
          </aside>
        </div>
    </div>
  );
}

/**
 * Header of one album section: its name (edited in place), product count, subtotal, order and
 * delete controls, and the customer's long note for it. The "Unsorted" group gets name, count and
 * subtotal only.
 */
function SectionHeader({
  collectionId,
  section,
  index,
  total,
  rows,
  focus,
  onFocused,
}: {
  collectionId: string;
  section: AlbumSection | null;
  index: number;
  total: number;
  rows: AlbumRow[];
  focus: boolean;
  onFocused: () => void;
}) {
  const a = useT().album;
  const s = a.sections;
  const input = useRef<HTMLInputElement>(null);
  const subtotal = rows.reduce((n, r) => n + r.priceCents * r.quantity, 0);

  useEffect(() => {
    if (!focus || !input.current) return;
    input.current.scrollIntoView({ block: "center", behavior: "smooth" });
    input.current.focus({ preventScroll: true });
    input.current.select();
    onFocused();
  }, [focus, onFocused]);

  const commit = (value: string) => {
    if (section && value.trim() && value.trim() !== section.name) updateSection(collectionId, section.id, { name: value });
    else if (input.current && section) input.current.value = section.name;
  };

  const ctl = "flex size-[33px] items-center justify-center text-ink transition-colors hover:text-accent disabled:pointer-events-none disabled:opacity-25";

  return (
    <div className="flex flex-col gap-4 border-t border-dark pt-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-8">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          {section ? (
            <input
              ref={input}
              key={section.name}
              defaultValue={section.name}
              maxLength={120}
              aria-label={s.nameLabel}
              onBlur={(e) => commit(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
                if (e.key === "Escape") {
                  e.currentTarget.value = section.name;
                  e.currentTarget.blur();
                }
              }}
              className="-mx-2 w-full min-w-0 border border-transparent bg-transparent px-2 py-1 text-[28px] font-medium leading-[1.1] tracking-[-0.04em] text-black transition-colors hover:border-[#ddd] focus:border-dark focus:outline-none md:text-[36px]"
            />
          ) : (
            <h2 className="py-1 text-[28px] font-medium leading-[1.1] tracking-[-0.04em] text-black md:text-[36px]">{s.unsorted}</h2>
          )}
          <p className="text-[15px] leading-none tracking-[-0.02em] text-secondary">
            {a.count(rows.length)}
            {rows.length > 0 && (
              <>
                {"  ·  "}
                {s.subtotal}{" "}
                <span className="font-semibold text-[#1b2a41]">
                  {a.from} {eur(subtotal)}
                </span>
              </>
            )}
          </p>
        </div>
        {section && (
          <div className="flex items-center gap-1 md:pt-2">
            <button type="button" aria-label={s.up(section.name)} disabled={index <= 0} onClick={() => moveSection(collectionId, section.id, -1)} className={ctl}>
              <Icon d={UP} />
            </button>
            <button type="button" aria-label={s.down(section.name)} disabled={index >= total - 1} onClick={() => moveSection(collectionId, section.id, 1)} className={ctl}>
              <Icon d={DOWN} />
            </button>
            <button
              type="button"
              onClick={() => {
                if (window.confirm(s.confirmDelete(section.name))) deleteSection(collectionId, section.id);
              }}
              className="ml-3 whitespace-nowrap text-[13px] text-[#fb3b30] underline"
            >
              {s.delete}
            </button>
          </div>
        )}
      </div>
      {section && (
        <AutoNote
          key={section.id}
          value={section.note}
          label={s.noteLabel(section.name)}
          placeholder={s.notePlaceholder}
          onSave={(v) => updateSection(collectionId, section.id, { note: v })}
        />
      )}
    </div>
  );
}
