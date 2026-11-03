"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { AdminNotification } from "@/lib/notifications";
import { cn } from "@/lib/cn";

const POLL_MS = 30_000;

const ago = (iso: string) => {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "ką tik";
  if (s < 3600) return `prieš ${Math.floor(s / 60)} min.`;
  if (s < 86400) return `prieš ${Math.floor(s / 3600)} val.`;
  return new Date(iso).toLocaleDateString("lt-LT");
};

/** A short two-note chime, made in the browser (no audio file). */
function chime() {
  try {
    const ctx = new AudioContext();
    [880, 1320].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.15);
      g.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + i * 0.15 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.15 + 0.4);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + i * 0.15);
      o.stop(ctx.currentTime + i * 0.15 + 0.45);
    });
  } catch {
    // audio blocked until the user interacts with the page: ignore
  }
}

/**
 * Bell in the admin sidebar: unread website inquiries (and new client accounts for administrators),
 * checked every 30 s. A new one rings, shows a browser notification (if allowed) and puts the count
 * in the tab title.
 */
export function NotificationBell() {
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<AdminNotification[]>([]);
  const [open, setOpen] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const known = useRef<Set<string> | null>(null);
  const box = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setPermission(typeof Notification === "undefined" ? "unsupported" : Notification.permission);
    try {
      const res = await fetch("/api/admin/notifications", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { unread: number; items: AdminNotification[] };
      const fresh = known.current ? data.items.filter((i) => i.unread && !known.current!.has(i.id)) : [];
      known.current = new Set(data.items.map((i) => i.id));
      setUnread(data.unread);
      setItems(data.items);
      if (fresh.length) {
        chime();
        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          for (const n of fresh.slice(0, 3)) {
            const note = new Notification(n.title, { body: n.body, tag: n.id });
            note.onclick = () => {
              window.focus();
              window.location.href = n.href;
            };
          }
        }
      }
    } catch {
      // offline: try again on the next tick
    }
  }, []);

  useEffect(() => {
    const first = setTimeout(load, 0);
    const timer = setInterval(load, POLL_MS);
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [load]);

  // the count in the browser tab, so a new inquiry is visible from another tab
  useEffect(() => {
    const base = document.title.replace(/^\(\d+\)\s*/, "");
    document.title = unread ? `(${unread}) ${base}` : base;
  }, [unread]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && unread) {
      // shown as read from now on; the dots stay until the panel closes
      void fetch("/api/admin/notifications", { method: "POST" }).then(() => setUnread(0));
    }
    if (!next) setItems((list) => list.map((i) => ({ ...i, unread: false })));
  };

  const allow = async () => {
    if (typeof Notification === "undefined") return;
    setPermission(await Notification.requestPermission());
  };

  return (
    <div ref={box} className="relative">
      <button type="button" onClick={toggle} aria-label={`Pranešimai${unread ? `: ${unread} nauji` : ""}`} className="relative flex h-9 w-9 items-center justify-center rounded-full hover:bg-zinc-100">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#c30a1e] px-1 text-[11px] font-semibold text-white">{unread > 99 ? "99+" : unread}</span>
        )}
      </button>
      {open && (
        <div className="absolute left-0 top-11 z-50 w-[360px] overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
            <p className="text-sm font-semibold">Pranešimai</p>
            <Link href="/admin/leads" onClick={() => setOpen(false)} className="text-xs text-zinc-500 underline">
              Visos užklausos
            </Link>
          </div>
          {permission === "default" && (
            <button type="button" onClick={allow} className="block w-full border-b border-zinc-200 bg-zinc-50 px-4 py-2 text-left text-xs text-zinc-600 hover:bg-zinc-100">
              🔔 Įjungti naršyklės pranešimus apie naujas užklausas
            </button>
          )}
          {permission === "denied" && <p className="border-b border-zinc-200 bg-zinc-50 px-4 py-2 text-xs text-zinc-500">Naršyklės pranešimai užblokuoti – leiskite juos naršyklės nustatymuose.</p>}
          <div className="max-h-[420px] overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-zinc-500">Pranešimų nėra.</p>
            ) : (
              items.map((n) => (
                <Link key={n.id} href={n.href} onClick={() => setOpen(false)} className={cn("flex gap-3 border-b border-zinc-100 px-4 py-3 hover:bg-zinc-50", n.unread && "bg-red-50/40")}>
                  <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.unread ? "bg-[#c30a1e]" : "bg-transparent")} />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-zinc-900">{n.title}</span>
                    {n.body && <span className="line-clamp-2 block text-xs text-zinc-500">{n.body}</span>}
                    <span className="mt-0.5 block text-[11px] text-zinc-400">{ago(n.at)}</span>
                  </span>
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
