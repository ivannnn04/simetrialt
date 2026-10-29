"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useHref, useT } from "@/i18n/client";

/**
 * "You are not signed in" dialog shown when a visitor without an account tries to save a product
 * (heart) or create an album. Both buttons bring the visitor back to the same page afterwards.
 */
export function LoginPrompt({ onClose }: { onClose: () => void }) {
  const t = useT().save;
  const href = useHref();
  const pathname = usePathname();
  const next = encodeURIComponent(pathname || "/");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center overflow-y-auto bg-black/20 px-4 py-10 backdrop-blur-[10px] menu-fade"
      onPointerDown={(e) => e.target === e.currentTarget && onClose()}
      onClick={(e) => e.stopPropagation()}
    >
      <div role="dialog" aria-modal="true" aria-labelledby="login-prompt-title" className="my-auto flex w-full max-w-[440px] flex-col gap-8 bg-white p-5 sm:p-8">
        <div className="flex w-full items-start justify-between gap-6">
          <h2 id="login-prompt-title" className="text-[24px] font-semibold leading-[1.3] tracking-[-0.04em] text-[#1a1c18]">
            {t.loginTitle}
          </h2>
          <button type="button" aria-label={t.close} onClick={onClose} className="shrink-0 text-[#1a1c18] transition-colors hover:text-accent">
            <svg viewBox="0 0 24 24" className="size-6" fill="none" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <p className="text-[16px] leading-[1.4] tracking-[-0.03em] text-secondary">{t.loginText}</p>
        <div className="flex w-full flex-col gap-3">
          <Link
            href={href(`/account/login?next=${next}`)}
            className="flex h-[39px] w-full items-center justify-center bg-dark px-8 text-[13px] font-medium text-white transition-colors hover:bg-accent"
          >
            {t.loginButton}
          </Link>
          <Link
            href={href(`/account/register?next=${next}`)}
            className="flex h-[39px] w-full items-center justify-center border border-dark px-8 text-[13px] font-medium text-black transition-colors hover:bg-dark hover:text-white"
          >
            {t.registerButton}
          </Link>
        </div>
      </div>
    </div>,
    document.body
  );
}
