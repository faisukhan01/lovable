"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { UserT } from "@/lib/types";

interface AuthState {
  token: string | null;
  user: UserT | null;
  hasHydrated: boolean;
  setAuth: (token: string, user: UserT) => void;
  clear: () => void;
  setHasHydrated: (v: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      hasHydrated: false,
      setAuth: (token, user) => set({ token, user }),
      clear: () => set({ token: null, user: null }),
      setHasHydrated: (v) => set({ hasHydrated: v }),
    }),
    {
      name: "lovify-auth",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ token: state.token, user: state.user }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);

/**
 * The pending prompt typed on the landing page (or chat) before auth.
 * Stored with a timestamp so a stale stash never hijacks a later session.
 */
const PENDING_KEY = "lovify:pendingPrompt";
const PENDING_MAX_AGE_MS = 30 * 60 * 1000; // 30 minutes

export function stashPendingPrompt(prompt: string) {
  try {
    sessionStorage.setItem(
      PENDING_KEY,
      JSON.stringify({ prompt, at: Date.now() })
    );
  } catch {
    /* ignore */
  }
}

/** Returns the stashed prompt if it exists and is fresh, then clears it. */
export function popPendingPrompt(): string | null {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(PENDING_KEY);
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof (parsed as { prompt?: unknown }).prompt === "string" &&
      typeof (parsed as { at?: unknown }).at === "number"
    ) {
      const { prompt, at } = parsed as { prompt: string; at: number };
      if (Date.now() - at <= PENDING_MAX_AGE_MS && prompt.trim()) return prompt;
    }
    return null;
  } catch {
    return null;
  }
}

export function clearPendingPrompt() {
  try {
    sessionStorage.removeItem(PENDING_KEY);
  } catch {
    /* ignore */
  }
}
