"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

type SavedContext = { has: (id: string) => boolean; mark: (id: string, saved: boolean) => void };

const Ctx = createContext<SavedContext>({ has: () => false, mark: () => {} });

/** Which products the visitor has saved to an album, so hearts render filled everywhere (Figma card "saved" state). */
export function SavedProvider({ initial, children }: { initial: string[]; children: React.ReactNode }) {
  const [ids, setIds] = useState(() => new Set(initial));
  const has = useCallback((id: string) => ids.has(id), [ids]);
  const mark = useCallback((id: string, saved: boolean) => {
    setIds((prev) => {
      if (prev.has(id) === saved) return prev;
      const next = new Set(prev);
      if (saved) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);
  const value = useMemo(() => ({ has, mark }), [has, mark]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useSaved = () => useContext(Ctx);
