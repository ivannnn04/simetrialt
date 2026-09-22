"use client";

import { Field } from "@/components/ui/Field";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { addToCollection, getMyCollections, type CollectionSummary } from "@/actions/collections";
import { HeartIcon } from "@/components/ui/Icons";
import { cn } from "@/lib/cn";
import { useSaved } from "@/components/catalogue/SavedProvider";
import { PRODUCT_PLACEHOLDER_IMAGE } from "@/lib/placeholder";

type Props = {
  productId: string;
  className?: string;
  light?: boolean;
  /** force the filled ("saved") heart, e.g. inside an album where every product is saved */
  saved?: boolean;
};

const PANEL_WIDTH = 417;

/**
 * Heart button on product cards. Opens the Figma "Save to" panel (node 4217:47501) anchored to
 * the heart: its top-right corner sits on the heart's top-right (Figma "Add to collection",
 * 4217:47427). Anonymous visitors see a sign-in prompt in the same panel.
 */
export function SaveButton({ productId, className, light, saved: forced }: Props) {
  const pathname = usePathname();
  const savedIds = useSaved();
  const anchor = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const [open, setOpen] = useState(false);
  const [anonymous, setAnonymous] = useState(false);
  const [collections, setCollections] = useState<CollectionSummary[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const openPanel = () => {
    start(async () => {
      const list = await getMyCollections(productId);
      setAnonymous(list === null);
      setCollections(list);
      setOpen(true);
    });
  };

  // Position the panel on the heart and keep it there on scroll / resize; close on Escape or
  // a click outside.
  useEffect(() => {
    if (!open) return;
    const place = () => {
      const r = anchor.current?.getBoundingClientRect();
      if (!r) return;
      const vw = window.innerWidth;
      // right edge on the heart's right edge, kept inside the viewport with a 16px margin
      const right = Math.max(16, Math.min(vw - r.right, vw - PANEL_WIDTH - 16));
      setPos({ top: Math.max(16, r.top), right });
    };
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (panel.current?.contains(t) || anchor.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  const next = encodeURIComponent(pathname);

  const save = (collectionId: string, name?: string) => {
    start(async () => {
      const res = await addToCollection(productId, collectionId, name);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setError(null);
      savedIds.mark(productId, true);
      {
        setSaved(res.name);
        setCreating(false);
        setNewName("");
        setCollections((prev) =>
          prev
            ? collectionId === "new"
              ? [{ id: res.collectionId, name: res.name, count: 1, hasProduct: true }, ...prev]
              : prev.map((c) => (c.id === collectionId ? { ...c, hasProduct: true, count: c.count + 1 } : c))
            : prev
        );
      }
    });
  };

  const isSaved = forced ?? (collections?.some((c) => c.hasProduct) || savedIds.has(productId));

  return (
    <div className={cn("relative", className)}>
      <button
        ref={anchor}
        type="button"
        aria-label="Save to collection"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (open) setOpen(false);
          else openPanel();
        }}
        className={cn(
          "flex size-6 items-center justify-center transition-colors duration-300",
          light ? "text-white" : "text-black group-hover:text-white" // white over the card's hover photo
        )}
      >
        {/* Figma saved state: solid heart in the ink colour */}
        <HeartIcon className={cn("transition-[fill] duration-300", isSaved ? "fill-current" : "fill-transparent")} />
      </button>

      {open &&
        pos &&
        createPortal(
          <div
            ref={panel}
            role="dialog"
            aria-modal="false"
            aria-label="Save to"
            className="fixed z-[90] flex w-[calc(100vw-32px)] max-w-[417px] flex-col items-end gap-8 bg-white p-6 text-left shadow-[0_12px_40px_rgba(0,0,0,0.12)] sm:gap-11 sm:p-10"
            style={{ top: pos.top, right: pos.right }}
            onClick={(e) => e.stopPropagation()}
          >
            <>
              <div className="flex w-full items-center justify-between">
                <p className="text-[24px] font-semibold leading-[1.3] tracking-[-0.04em] text-[#1a1c18]">Save to</p>
                <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="text-[#1a1c18]">
                  <svg viewBox="0 0 24 24" className="size-6" fill="none" aria-hidden>
                    <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              </div>

              {anonymous ? (
                <>
                  <p className="w-full text-[16px] leading-[1.3] tracking-[-0.04em] text-label">
                    Sign in to your account to save products to your albums and build moodboards for your projects.
                  </p>
                  <div className="flex w-full flex-col gap-2">
                    <Link
                      href={`/account/login?next=${next}`}
                      className="w-full bg-dark px-8 py-[11px] text-center text-[13px] font-medium text-white transition-colors hover:bg-accent"
                    >
                      Sign in
                    </Link>
                    <Link
                      href={`/account/register?next=${next}`}
                      className="w-full border border-line px-8 py-[11px] text-center text-[13px] font-medium text-black transition-colors hover:border-dark"
                    >
                      Create an account
                    </Link>
                  </div>
                </>
              ) : (
                <>
                  <ul className="flex w-full flex-col">
                    {collections?.map((c) => (
                      <li key={c.id} className="border-b border-[#e3e3e3]">
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => save(c.id)}
                          className="flex w-full items-center gap-[22px] px-2 py-2.5 text-left transition-colors hover:bg-cream sm:px-5"
                        >
                          <span className="flex size-[59px] shrink-0 items-center justify-center overflow-hidden bg-[#f2f2f2]">
                            {PRODUCT_PLACEHOLDER_IMAGE && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={PRODUCT_PLACEHOLDER_IMAGE} alt="" className="max-h-[70%] max-w-[85%] object-contain" />
                            )}
                          </span>
                          <span className="flex flex-1 flex-col">
                            <span className="text-[18px] font-medium leading-[1.3] tracking-[-0.04em] text-[#1a1c18] sm:text-[20px]">{c.name}</span>
                            {c.hasProduct && <span className="text-[12px] text-accent">Saved</span>}
                          </span>
                        </button>
                      </li>
                    ))}
                    {collections?.length === 0 && !creating && (
                      <li className="py-2 text-[14px] text-secondary">No collections yet — create your first one.</li>
                    )}
                  </ul>

                  {creating ? (
                    <form
                      className="flex w-full flex-col gap-3"
                      onSubmit={(e) => {
                        e.preventDefault();
                        save("new", newName);
                      }}
                    >
                      <Field
                        autoFocus
                        name="collection-name"
                        label="Collection name"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                      />
                      <button
                        type="submit"
                        disabled={pending || !newName.trim()}
                        className="w-full bg-dark px-8 py-[11px] text-[13px] font-medium text-white transition-colors hover:bg-accent disabled:opacity-50 disabled:hover:bg-dark"
                      >
                        Save to new collection
                      </button>
                    </form>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setCreating(true)}
                      className="w-full bg-dark px-8 py-[11px] text-center text-[13px] font-medium text-white transition-colors hover:bg-accent"
                    >
                      Create new collection
                    </button>
                  )}
                  {saved && <p className="w-full text-[13px] text-secondary">Saved to “{saved}”.</p>}
                  {error && <p className="w-full text-[13px] text-[#fb3b30]">{error}</p>}
                </>
              )}
            </>
          </div>,
          document.body
        )}
    </div>
  );
}
