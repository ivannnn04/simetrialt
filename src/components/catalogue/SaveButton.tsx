"use client";

import { Field } from "@/components/ui/Field";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { HeartIcon } from "@/components/ui/Icons";
import { cn } from "@/lib/cn";
import { useT } from "@/i18n/client";
import { addToAlbum, createAlbum, isSavedAnywhere, useAlbums, type SavedProduct } from "@/lib/albums-store";
import { PRODUCT_PLACEHOLDER_IMAGE } from "@/lib/placeholder";
import { loadAccount, useAccount } from "@/lib/account-client";
import { LoginPrompt } from "@/components/account/LoginPrompt";

type Props = {
  productId: string;
  /** snapshot stored with the album so it can render without a database */
  product: SavedProduct;
  className?: string;
  light?: boolean;
  /** force the filled ("saved") heart, e.g. inside an album where every product is saved */
  saved?: boolean;
};

const PANEL_WIDTH = 417;
const PANEL_WIDTH_SMALL = 340; // below lg

/**
 * Heart button on product cards. Opens the Figma "Save to" panel (node 4217:47501) anchored to
 * the heart: its top-right corner sits on the heart's top-right (Figma "Add to collection",
 * 4217:47427). Albums belong to a customer account: a visitor who is not signed in gets the
 * "You are not signed in" dialog instead of the panel.
 */
export function SaveButton({ productId, product, className, light, saved: forced }: Props) {
  const albums = useAlbums();
  const account = useAccount();
  const [prompt, setPrompt] = useState(false);
  const t = useT().save;
  const anchor = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [saved, setSaved] = useState<string | null>(null);
  const pending = false;

  const collections = albums.map((a) => ({ id: a.id, name: a.name, count: a.items.length, hasProduct: a.items.some((i) => i.product.id === productId) }));
  const openPanel = () => setOpen(true);

  // Position the panel on the heart and keep it there on scroll / resize; close on Escape or
  // a click outside.
  const place = useCallback(() => {
    const r = anchor.current?.getBoundingClientRect();
    if (!r) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // right edge on the heart's right edge, kept inside the viewport with a 16px margin
    const panelWidth = vw >= 1024 ? PANEL_WIDTH : PANEL_WIDTH_SMALL;
    const right = Math.max(16, Math.min(vw - r.right, vw - panelWidth - 16));
    // keep the whole panel on screen: never lower than viewport height minus its own height
    const ph = panel.current?.offsetHeight ?? 0;
    const top = Math.max(16, Math.min(r.top, vh - ph - 16));
    setPos((prev) => (prev && prev.top === top && prev.right === right ? prev : { top, right }));
  }, []);

  // Re-measure once the panel has rendered (its height changes with the content); `pos` is a
  // dependency so the first measurement, taken before the panel exists, is corrected at once.
  useLayoutEffect(() => {
    if (open) place();
  }, [open, pos, creating, saved, albums.length, place]);

  useEffect(() => {
    if (!open) return;
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
  }, [open, place]);

  const save = (collectionId: string, name?: string) => {
    const target = collectionId === "new" ? createAlbum(name ?? "") : albums.find((a) => a.id === collectionId);
    if (!target) return;
    addToAlbum(target.id, product);
    setSaved(target.name);
    setCreating(false);
    setNewName("");
  };

  // hearts are only filled for the signed-in customer's own albums
  const isSaved = forced ?? (account?.signedIn ? isSavedAnywhere(albums, productId) : false);

  return (
    <div className={cn("relative", className)}>
      <button
        ref={anchor}
        type="button"
        aria-label={t.button}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (open) return setOpen(false);
          const go = (signedIn: boolean) => (signedIn ? openPanel() : setPrompt(true));
          // signed in → panel at once; otherwise confirm with the server before asking to sign in
          if (account?.signedIn) go(true);
          else void loadAccount(true).then((s) => go(s.signedIn));
        }}
        className={cn(
          "flex size-6 items-center justify-center transition-colors duration-300",
          light ? "text-white" : "text-black group-hover:text-white" // white over the card's hover photo
        )}
      >
        {/* Figma saved state: solid heart in the ink colour */}
        <HeartIcon className={cn("transition-[fill] duration-300", isSaved ? "fill-current" : "fill-transparent")} />
      </button>
      {prompt && <LoginPrompt onClose={() => setPrompt(false)} />}

      {open &&
        pos &&
        createPortal(
          <div
            ref={panel}
            role="dialog"
            aria-modal="false"
            aria-label={t.title}
            className="fixed z-[90] flex w-[calc(100vw-32px)] max-w-[340px] flex-col items-end gap-6 bg-white p-5 text-left shadow-[0_12px_40px_rgba(0,0,0,0.12)] lg:max-w-[417px] lg:gap-11 lg:p-10"
            style={{ top: pos.top, right: pos.right }}
            onClick={(e) => e.stopPropagation()}
          >
            <>
              <div className="flex w-full items-center justify-between">
                <p className="text-[20px] font-semibold leading-[1.3] tracking-[-0.04em] text-[#1a1c18] lg:text-[24px]">{t.title}</p>
                <button type="button" aria-label={t.close} onClick={() => setOpen(false)} className="text-[#1a1c18]">
                  <svg viewBox="0 0 24 24" className="size-6" fill="none" aria-hidden>
                    <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              </div>

              {(
                <>
                  <ul className="flex w-full flex-col">
                    {collections.map((c) => (
                      <li key={c.id} className="border-b border-[#e3e3e3]">
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => save(c.id)}
                          className="flex w-full items-center gap-4 px-2 py-2 text-left transition-colors hover:bg-cream lg:gap-[22px] lg:px-5 lg:py-2.5"
                        >
                          <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden bg-[#f2f2f2] lg:size-[59px]">
                            {PRODUCT_PLACEHOLDER_IMAGE && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={PRODUCT_PLACEHOLDER_IMAGE} alt="" className="max-h-[70%] max-w-[85%] object-contain" />
                            )}
                          </span>
                          <span className="flex flex-1 flex-col">
                            <span className="text-[16px] font-medium leading-[1.3] tracking-[-0.04em] text-[#1a1c18] lg:text-[20px]">{c.name}</span>
                            {c.hasProduct && <span className="text-[12px] text-accent">{t.saved}</span>}
                          </span>
                        </button>
                      </li>
                    ))}
                    {collections.length === 0 && !creating && (
                      <li className="py-2 text-[14px] text-secondary">{t.empty}</li>
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
                        label={t.name}
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                      />
                      <button
                        type="submit"
                        disabled={pending || !newName.trim()}
                        className="w-full bg-dark px-8 py-[11px] text-[13px] font-medium text-white transition-colors hover:bg-accent disabled:opacity-50 disabled:hover:bg-dark"
                      >
                        {t.saveNew}
                      </button>
                    </form>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setCreating(true)}
                      className="w-full bg-dark px-8 py-[11px] text-center text-[13px] font-medium text-white transition-colors hover:bg-accent"
                    >
                      {t.create}
                    </button>
                  )}
                  {saved && <p className="w-full text-[13px] text-secondary">{t.savedTo(saved)}</p>}
                </>
              )}
            </>
          </div>,
          document.body
        )}
    </div>
  );
}
