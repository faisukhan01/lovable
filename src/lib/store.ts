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

/** Convenience: the pending prompt typed on the landing page before auth. */
export function stashPendingPrompt(prompt: string) {
  try {
    sessionStorage.setItem("lovify:pendingPrompt", prompt);
  } catch {
    /* ignore */
  }
}

export function popPendingPrompt(): string | null {
  try {
    const v = sessionStorage.getItem("lovify:pendingPrompt");
    if (v) sessionStorage.removeItem("lovify:pendingPrompt");
    return v;
  } catch {
    return null;
  }
}
