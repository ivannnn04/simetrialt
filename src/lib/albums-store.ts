"use client";

import { useSyncExternalStore } from "react";
import type { ProductCardData } from "@/components/catalogue/ProductCard";
import type { AccountStatus } from "@/lib/account-client";
import { loadMyAlbums, saveMyAlbums } from "@/actions/albums-sync";

/**
 * Albums of the signed-in customer. The browser keeps a copy in localStorage so pages render at
 * once; the customer's account in the database is the source of truth (loaded on sign-in, and
 * every change is saved back shortly after it is made). Product data is snapshotted when a
 * product is saved so album pages can render it later.
 */
export type SavedProduct = {
  id: string;
  name: string;
  category: string;
  brand: string;
  price: string;
  salePrice?: string | null;
  priceCents: number;
  image: string | null;
  href: string;
};

export type AlbumItem = { product: SavedProduct; quantity: number; note: string; addedAt: number };

export type Album = { id: string; name: string; createdAt: number; updatedAt: number; items: AlbumItem[] };

type State = { albums: Album[] };

const KEY = "simetria.albums.v1";
/** customer id the local copy belongs to */
const OWNER_KEY = "simetria.albums.owner";
let owner: string | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
const EMPTY: State = { albums: [] };
const listeners = new Set<() => void>();
let cache: State | null = null;

const parsePrice = (s: string) => Math.round(Number(s.replace(/[^0-9.]/g, "")) * 100) || 0;

export function toSavedProduct(p: ProductCardData & { brand?: string }): SavedProduct {
  return {
    id: p.id,
    name: p.name,
    category: p.category,
    brand: p.brand ?? "",
    price: p.price,
    salePrice: p.salePrice ?? null,
    priceCents: parsePrice(p.salePrice ?? p.price),
    image: p.image ?? null,
    href: p.href,
  };
}

function read(): State {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw ? (JSON.parse(raw) as State) : EMPTY;
  } catch {
    cache = EMPTY;
  }
  return cache;
}

function write(next: State, sync = true) {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // storage unavailable (private mode): state stays in memory for this page
  }
  listeners.forEach((l) => l());
  if (sync && owner) {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      void saveMyAlbums(read().albums).catch(() => undefined);
    }, 500);
  }
}

const storage = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string | null) => {
    try {
      if (v == null) localStorage.removeItem(k);
      else localStorage.setItem(k, v);
    } catch {
      // ignore
    }
  },
};

/**
 * Links the local albums to the signed-in customer: loads the account's albums (albums made in this
 * browser before signing in are added to the account once), or hides a previous customer's albums
 * after signing out.
 */
export async function connectAccount(status: AccountStatus): Promise<void> {
  if (!status.signedIn || !status.id) {
    owner = null;
    if (storage.get(OWNER_KEY)) {
      storage.set(OWNER_KEY, null);
      write(EMPTY, false);
    }
    return;
  }
  if (owner === status.id) return;
  const server = await loadMyAlbums().catch(() => null);
  if (!server) return;
  const previous = storage.get(OWNER_KEY);
  const local = read().albums;
  let albums: Album[] = server;
  let push = false;
  if (!previous && local.length) {
    const ids = new Set(server.map((a) => a.id));
    albums = [...local.filter((a) => !ids.has(a.id)), ...server];
    push = albums.length !== server.length;
  }
  owner = status.id;
  storage.set(OWNER_KEY, status.id);
  write({ albums }, push);
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null;
      cb();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

/** Reactive albums state; empty on the server and during hydration. */
export function useAlbums(): Album[] {
  return useSyncExternalStore(subscribe, () => read().albums, () => EMPTY.albums);
}

const update = (fn: (albums: Album[]) => Album[]) => write({ albums: fn(read().albums) });
const newId = () => `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

export function createAlbum(name: string): Album {
  const now = Date.now();
  const album: Album = { id: newId(), name: name.trim() || "My collection", createdAt: now, updatedAt: now, items: [] };
  update((as) => [album, ...as]);
  return album;
}

export function renameAlbum(id: string, name: string) {
  update((as) => as.map((a) => (a.id === id ? { ...a, name: name.trim() || a.name, updatedAt: Date.now() } : a)));
}

export function deleteAlbum(id: string) {
  update((as) => as.filter((a) => a.id !== id));
}

export function addToAlbum(id: string, product: SavedProduct) {
  update((as) =>
    as.map((a) =>
      a.id !== id || a.items.some((i) => i.product.id === product.id)
        ? a
        : { ...a, updatedAt: Date.now(), items: [{ product, quantity: 1, note: "", addedAt: Date.now() }, ...a.items] }
    )
  );
}

export function removeFromAlbum(id: string, productId: string) {
  update((as) => as.map((a) => (a.id === id ? { ...a, updatedAt: Date.now(), items: a.items.filter((i) => i.product.id !== productId) } : a)));
}

export function updateAlbumItem(id: string, productId: string, patch: { quantity?: number; note?: string }) {
  update((as) =>
    as.map((a) =>
      a.id === id
        ? {
            ...a,
            updatedAt: Date.now(),
            items: a.items.map((i) =>
              i.product.id === productId
                ? {
                    ...i,
                    quantity: patch.quantity != null ? Math.max(1, Math.min(999, Math.round(patch.quantity))) : i.quantity,
                    note: patch.note != null ? patch.note.slice(0, 500) : i.note,
                  }
                : i
            ),
          }
        : a
    )
  );
}

export const isSavedAnywhere = (albums: Album[], productId: string) => albums.some((a) => a.items.some((i) => i.product.id === productId));

export type RelativeTimeLabels = { now: string; min: (n: number) => string; hours: (n: number) => string; day: string; days: (n: number) => string };

export function relativeTime(ts: number, l: RelativeTimeLabels): string {
  const min = Math.round((Date.now() - ts) / 60000);
  if (min < 1) return l.now;
  if (min < 60) return l.min(min);
  const h = Math.round(min / 60);
  if (h < 24) return l.hours(h);
  const d = Math.round(h / 24);
  return d === 1 ? l.day : l.days(d);
}
