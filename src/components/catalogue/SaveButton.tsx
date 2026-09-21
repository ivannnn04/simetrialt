"use client";

import { Field } from "@/components/ui/Field";

import { useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { addToCollection, getMyCollections, type CollectionSummary } from "@/actions/collections";
import { HeartIcon } from "@/components/ui/Icons";
import { cn } from "@/lib/cn";
import { PRODUCT_PLACEHOLDER_IMAGE } from "@/lib/placeholder";

type Props = { productId: string; className?: string; light?: boolean };

/**
 * Heart button on product cards. Opens the Figma "Save to" panel (node 4107:15972)
 * listing the customer's collections; anonymous visitors are sent to sign in.
 */
export function SaveButton({ productId, className, light }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [collections, setCollections] = useState<CollectionSummary[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const openPanel = () => {
    start(async () => {
      const list = await getMyCollections(productId);
      if (list === null) {
        router.push(`/account/login?next=${encodeURIComponent(pathname)}`);
        return;
      }
      setCollections(list);
      setOpen(true);
    });
  };

  const save = (collectionId: string, name?: string) => {
    start(async () => {
      const res = await addToCollection(productId, collectionId, name);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setError(null);
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

  const isSaved = collections?.some((c) => c.hasProduct) ?? false;

  return (
    <div className={cn("relative", className)}>
      <button
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
          light ? "text-white" : "text-black group-hover:text-white", // white over the card's hover photo
          isSaved && "text-accent"
        )}
      >
        <HeartIcon className={cn(isSaved && "fill-current")} />
      </button>

      {open && (
        <div
          className="absolute right-0 top-8 z-40 flex w-[296px] flex-col items-end gap-8 bg-white p-6 text-left shadow-[0_12px_40px_rgba(0,0,0,0.12)] sm:w-[320px] sm:gap-11 sm:p-10"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex w-full items-center justify-between">
            <p className="text-[24px] font-semibold leading-[1.3] tracking-[-0.04em] text-[#1a1c18]">Save to</p>
            <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="text-[#1a1c18]">
              <svg viewBox="0 0 24 24" className="size-6" fill="none" aria-hidden>
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <ul className="flex w-full flex-col">
            {collections?.map((c) => (
              <li key={c.id} className="border-b border-[#e3e3e3]">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => save(c.id)}
                  className="flex w-full items-center gap-5 px-2 py-2.5 text-left hover:bg-cream sm:px-5"
                >
                  <span className="relative flex size-[59px] shrink-0 items-center justify-center overflow-hidden bg-[#f2f2f2]">
                    {PRODUCT_PLACEHOLDER_IMAGE && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={PRODUCT_PLACEHOLDER_IMAGE} alt="" className="max-h-[70%] max-w-[85%] object-contain" />
                    )}
                    <span className="absolute bottom-0 right-0 bg-white/80 px-1 text-[10px] leading-none text-secondary">{c.count}</span>
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
              <button type="submit" disabled={pending || !newName.trim()} className="w-full bg-dark px-8 py-[11px] text-[13px] font-medium text-white disabled:opacity-50">
                Save to new collection
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="w-full bg-dark px-8 py-[11px] text-center text-[13px] font-medium text-white hover:bg-ink"
            >
              Create new collection
            </button>
          )}
          {saved && <p className="w-full text-[13px] text-secondary">Saved to “{saved}”.</p>}
          {error && <p className="w-full text-[13px] text-[#fb3b30]">{error}</p>}
        </div>
      )}
    </div>
  );
}
