"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { createAlbum } from "@/lib/albums-store";
import { Field } from "@/components/ui/Field";
import { cn } from "@/lib/cn";

/**
 * "New collection" button opening the Figma "create new collection" modal (node 4117:21198):
 * dimmed, blurred backdrop; 440px white card with a title, an empty album preview, the
 * Collection name field and a full-width Create button.
 */
export function NewCollectionButton({ className }: { className?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | undefined>();
  const pending = false;
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Please name the collection.");
      return;
    }
    const album = createAlbum(name);
    setOpen(false);
    setName("");
    router.push(`/account/albums/${album.id}`);
  };

  // Close on Escape and lock page scroll while the dialog is open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "flex h-[39px] items-center justify-center whitespace-nowrap bg-dark px-4 text-center text-[13px] font-medium text-white transition-colors duration-300 hover:bg-accent md:px-8",
          className
        )}
      >
        New collection
      </button>

      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/20 px-4 py-10 backdrop-blur-[10px] menu-fade sm:py-[116px]"
            onPointerDown={(e) => e.target === e.currentTarget && setOpen(false)}
          >
            <form
              onSubmit={submit}
              role="dialog"
              aria-modal="true"
              aria-labelledby="new-collection-title"
              className="flex w-full max-w-[440px] flex-col items-center gap-10 bg-white p-5 sm:gap-[62px] sm:p-8"
            >
              <div className="flex w-full flex-col items-center gap-8 sm:gap-11">
                <div className="flex w-full items-center justify-between">
                  <h2 id="new-collection-title" className="text-[24px] font-semibold leading-[1.3] tracking-[-0.04em] text-[#1a1c18]">
                    Create new collection
                  </h2>
                  <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="text-[#1a1c18] transition-colors hover:text-accent">
                    <svg viewBox="0 0 24 24" className="size-6" fill="none" aria-hidden>
                      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>

                {/* empty album preview: one tall tile and two small ones */}
                <div aria-hidden className="flex aspect-[278/237] w-full max-w-[278px] items-center gap-[2.5px]">
                  <div className="h-full flex-[169] bg-[#f2f2f2]" />
                  <div className="flex h-full flex-[106] flex-col gap-[2.5px]">
                    <div className="flex-1 bg-[#f2f2f2]" />
                    <div className="flex-1 bg-[#f2f2f2]" />
                  </div>
                </div>

                <Field
                  name="name"
                  label="Collection name"
                  autoFocus
                  maxLength={80}
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setError(undefined);
                  }}
                  error={error}
                  className="w-full"
                />
              </div>

              <button
                type="submit"
                disabled={pending}
                className="flex h-[39px] w-full items-center justify-center bg-dark px-8 text-[13px] font-medium text-white transition-colors duration-300 hover:bg-accent disabled:opacity-50"
              >
                {pending ? "Creating…" : "Create"}
              </button>
            </form>
          </div>,
          document.body
        )}
    </>
  );
}
