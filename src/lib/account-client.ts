"use client";

import { useSyncExternalStore } from "react";

/** Signed-in state of the website customer, fetched once per page load and shared by all components. */
export type AccountStatus = { signedIn: boolean; id?: string; name?: string };

let status: AccountStatus | null = null;
let inflight: Promise<AccountStatus> | null = null;
const listeners = new Set<() => void>();

export function loadAccount(force = false): Promise<AccountStatus> {
  if (status && !force) return Promise.resolve(status);
  if (inflight && !force) return inflight;
  inflight = fetch("/api/account/status", { cache: "no-store" })
    .then((r) => (r.ok ? (r.json() as Promise<AccountStatus>) : { signedIn: false }))
    .catch(() => ({ signedIn: false }))
    .then((s) => {
      status = s;
      inflight = null;
      listeners.forEach((l) => l());
      return s;
    });
  return inflight;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  if (!status) void loadAccount();
  return () => {
    listeners.delete(cb);
  };
}

/** null while unknown (first render), then the customer's status. */
export function useAccount(): AccountStatus | null {
  return useSyncExternalStore(subscribe, () => status, () => null);
}
