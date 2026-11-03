"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { useT } from "@/i18n/client";

type Props = {
  value: string;
  onSave: (value: string) => void;
  label: string;
  placeholder?: string;
  maxLength?: number;
  className?: string;
  /** read-only text (sample albums) */
  disabled?: boolean;
};

const DELAY = 700;

/**
 * Long free-text note that grows with its content and saves itself shortly after the customer stops
 * typing (and on blur), like the per-product note of the album table.
 */
export function AutoNote({ value, onSave, label, placeholder, maxLength = 5000, className, disabled }: Props) {
  const l = useT().album.projectNote;
  const ref = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState(value);
  const [state, setState] = useState<"idle" | "pending" | "saved">("idle");
  const [prev, setPrev] = useState(value);
  // a change made elsewhere (another tab, the account) shows up unless the customer is typing
  if (value !== prev) {
    setPrev(value);
    if (state !== "pending") setText(value);
  }

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef({ text, value, onSave });
  useEffect(() => {
    latest.current = { text, value, onSave };
  });
  const flush = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const { text: t, value: v, onSave: save } = latest.current;
    if (t !== v) save(t);
  };
  // save what is left when the page changes
  useEffect(
    () => () => {
      if (timer.current) flush();
    },
    []
  );

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [text]);

  useEffect(() => {
    if (state !== "saved") return;
    const t = setTimeout(() => setState("idle"), 1500);
    return () => clearTimeout(t);
  }, [state]);

  return (
    <div className={cn("relative", className)}>
      <textarea
        ref={ref}
        value={text}
        rows={2}
        disabled={disabled}
        maxLength={maxLength}
        aria-label={label}
        placeholder={placeholder}
        onChange={(e) => {
          setText(e.target.value);
          setState("pending");
          latest.current.text = e.target.value;
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => {
            timer.current = null;
            flush();
            setState("saved");
          }, DELAY);
        }}
        onBlur={() => {
          if (state === "pending") {
            flush();
            setState("saved");
          }
        }}
        className="block min-h-[64px] w-full resize-none overflow-hidden border border-[#ddd] bg-white/60 px-4 py-3 text-[16px] leading-[1.45] tracking-[-0.02em] text-[#1b2a41] placeholder:text-secondary focus:border-dark focus:bg-white focus:outline-none disabled:bg-transparent"
      />
      <span aria-live="polite" className={cn("pointer-events-none absolute bottom-2 right-3 text-[12px] text-secondary transition-opacity duration-300", state === "idle" ? "opacity-0" : "opacity-100")}>
        {state === "pending" ? l.saving : state === "saved" ? l.saved : ""}
      </span>
    </div>
  );
}
