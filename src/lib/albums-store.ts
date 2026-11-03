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

/** `sectionId` points to one of the album's sections; missing = "Unsorted". */
export type AlbumItem = { product: SavedProduct; quantity: number; note: string; addedAt: number; sectionId?: string };

/** A customer-made part of the project (a room, a floor…) with a free-text note. */
export type AlbumSection = { id: string; name: string; note: string; sort: number };

export type Album = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  items: AlbumItem[];
  /** general notes about the project */
  note: string;
  sections: AlbumSection[];
};

export const SECTION_NAME_MAX = 120;
export const NOTE_MAX = 5000;
export const SECTIONS_MAX = 50;

/**
 * Fills in what older copies (localStorage or account) lack: no note, no sections. Item section ids
 * that no longer exist fall back to unsorted; sections come back in their saved order.
 */
export function normalizeAlbum(raw: Partial<Album> & { id: string; name: string }): Album {
  const sections = (Array.isArray(raw.sections) ? raw.sections : [])
    .filter((s): s is AlbumSection => !!s && typeof s.id === "string" && typeof s.name === "string")
    .map((s, i) => ({ id: s.id, name: s.name, note: typeof s.note === "string" ? s.note : "", sort: Number.isFinite(s.sort) ? s.sort : i }))
    .sort((a, b) => a.sort - b.sort)
    .map((s, i) => ({ ...s, sort: i }));
  const ids = new Set(sections.map((s) => s.id));
  const items = (Array.isArray(raw.items) ? raw.items : []).map((i) => {
    const { sectionId, ...rest } = i;
    return sectionId && ids.has(sectionId) ? { ...rest, sectionId } : rest;
  });
  return {
    id: raw.id,
    name: raw.name,
    createdAt: raw.createdAt ?? Date.now(),
    updatedAt: raw.updatedAt ?? raw.createdAt ?? Date.now(),
    items,
    note: typeof raw.note === "string" ? raw.note : "",
    sections,
  };
}

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
    const parsed = raw ? (JSON.parse(raw) as { albums?: Album[] }) : null;
    cache = Array.isArray(parsed?.albums) ? { albums: parsed.albums.map(normalizeAlbum) } : EMPTY;
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
  let albums: Album[] = server.map(normalizeAlbum);
  let push = false;
  if (!previous && local.length) {
    const ids = new Set(server.map((a) => a.id));
    albums = [...local.filter((a) => !ids.has(a.id)), ...albums];
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
  const album: Album = { id: newId(), name: name.trim() || "My collection", createdAt: now, updatedAt: now, items: [], note: "", sections: [] };
  update((as) => [album, ...as]);
  return album;
}

export function renameAlbum(id: string, name: string) {
  update((as) => as.map((a) => (a.id === id ? { ...a, name: name.trim() || a.name, updatedAt: Date.now() } : a)));
}

export function deleteAlbum(id: string) {
  update((as) => as.filter((a) => a.id !== id));
}

export function addToAlbum(id: string, product: SavedProduct, sectionId?: string) {
  update((as) =>
    as.map((a) =>
      a.id !== id || a.items.some((i) => i.product.id === product.id)
        ? a
        : {
            ...a,
            updatedAt: Date.now(),
            items: [
              { product, quantity: 1, note: "", addedAt: Date.now(), ...(sectionId && a.sections.some((s) => s.id === sectionId) ? { sectionId } : {}) },
              ...a.items,
            ],
          }
    )
  );
}

const editAlbum = (id: string, fn: (a: Album) => Album) => update((as) => as.map((a) => (a.id === id ? { ...fn(a), updatedAt: Date.now() } : a)));

/** General notes about the project. */
export function setAlbumNote(id: string, note: string) {
  editAlbum(id, (a) => ({ ...a, note: note.slice(0, NOTE_MAX) }));
}

/** Adds a section at the end and returns its id (null when the album is missing or full). */
export function addSection(id: string, name: string): string | null {
  const album = read().albums.find((a) => a.id === id);
  if (!album || album.sections.length >= SECTIONS_MAX) return null;
  const sectionId = `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  editAlbum(id, (a) => ({
    ...a,
    sections: [...a.sections, { id: sectionId, name: name.trim().slice(0, SECTION_NAME_MAX) || "Section", note: "", sort: a.sections.length }],
  }));
  return sectionId;
}

export function updateSection(id: string, sectionId: string, patch: { name?: string; note?: string }) {
  editAlbum(id, (a) => ({
    ...a,
    sections: a.sections.map((s) =>
      s.id === sectionId
        ? {
            ...s,
            name: patch.name != null ? patch.name.trim().slice(0, SECTION_NAME_MAX) || s.name : s.name,
            note: patch.note != null ? patch.note.slice(0, NOTE_MAX) : s.note,
          }
        : s
    ),
  }));
}

/** Moves a section one place up (-1) or down (+1). */
export function moveSection(id: string, sectionId: string, dir: -1 | 1) {
  editAlbum(id, (a) => {
    const list = [...a.sections];
    const i = list.findIndex((s) => s.id === sectionId);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return a;
    [list[i], list[j]] = [list[j], list[i]];
    return { ...a, sections: list.map((s, k) => ({ ...s, sort: k })) };
  });
}

/** Deletes a section; its products stay in the album as unsorted. */
export function deleteSection(id: string, sectionId: string) {
  editAlbum(id, (a) => ({
    ...a,
    sections: a.sections.filter((s) => s.id !== sectionId).map((s, k) => ({ ...s, sort: k })),
    items: a.items.map((i) => {
      if (i.sectionId !== sectionId) return i;
      const { sectionId: _drop, ...rest } = i; // eslint-disable-line @typescript-eslint/no-unused-vars
      return rest;
    }),
  }));
}

/** Puts a product into a section, or back to unsorted with null. */
export function moveItemToSection(id: string, productId: string, sectionId: string | null) {
  editAlbum(id, (a) => ({
    ...a,
    items: a.items.map((i) => {
      if (i.product.id !== productId) return i;
      const { sectionId: _old, ...rest } = i; // eslint-disable-line @typescript-eslint/no-unused-vars
      return sectionId && a.sections.some((s) => s.id === sectionId) ? { ...rest, sectionId } : rest;
    }),
  }));
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
