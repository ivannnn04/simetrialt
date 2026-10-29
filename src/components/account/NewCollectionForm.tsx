"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useHref, useT } from "@/i18n/client";
import { createAlbum } from "@/lib/albums-store";
import { Field } from "@/components/ui/Field";
import { cn } from "@/lib/cn";
import { loadAccount } from "@/lib/account-client";
import { LoginPrompt } from "@/components/account/LoginPrompt";

/**
 * "New collection" button opening the Figma "create new collection" modal (node 4117:21198):
 * dimmed, blurred backdrop; 440px white card with a title, an empty album preview, the
 * Collection name field and a full-width Create button.
 */
export function NewCollectionButton({ className }: { className?: string }) {
  const router = useRouter();
  const href = useHref();
  const t = useT().newCollection;
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | undefined>();
  const pending = false;
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError(t.error);
      return;
    }
    const album = createAlbum(name);
    setOpen(false);
    setName("");
    router.push(href(`/account/albums/${album.id}`));
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
        onClick={() => void loadAccount(true).then((s) => (s.signedIn ? setOpen(true) : setPrompt(true)))}
        className={cn(
          "flex h-[39px] items-center justify-center whitespace-nowrap bg-dark px-4 text-center text-[13px] font-medium text-white transition-colors duration-300 hover:bg-accent md:px-8",
          className
        )}
      >
        {t.button}
      </button>

      {prompt && <LoginPrompt onClose={() => setPrompt(false)} />}
      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/20 px-4 py-10 backdrop-blur-[10px] menu-fade"
            onPointerDown={(e) => e.target === e.currentTarget && setOpen(false)}
          >
            <form
              onSubmit={submit}
              role="dialog"
              aria-modal="true"
              aria-labelledby="new-collection-title"
              className="my-auto flex w-full max-w-[440px] flex-col items-center gap-10 bg-white p-5 sm:gap-[62px] sm:p-8"
            >
              <div className="flex w-full flex-col items-center gap-8 sm:gap-11">
                <div className="flex w-full items-center justify-between gap-6">
                  <h2 id="new-collection-title" className="text-[24px] font-semibold leading-[1.3] tracking-[-0.04em] text-[#1a1c18]">
                    {t.title}
                  </h2>
                  <button type="button" aria-label={t.close} onClick={() => setOpen(false)} className="shrink-0 text-[#1a1c18] transition-colors hover:text-accent">
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
                  label={t.name}
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
                {pending ? t.creating : t.create}
              </button>
            </form>
          </div>,
          document.body
        )}
    </>
  );
}
