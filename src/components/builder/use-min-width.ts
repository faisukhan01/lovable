"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Reactive matchMedia hook built on useSyncExternalStore (no setState-in-effect).
 * Returns false during SSR / first paint, then tracks the viewport.
 */
export function useMinWidth(px: number): boolean {
  const query = `(min-width: ${px}px)`;

  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    [query]
  );

  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query]);

  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
