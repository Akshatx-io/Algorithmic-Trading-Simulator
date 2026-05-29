/**
 * Zustand auth store — reactive client-side auth state.
 *
 * Design (audit 3.11, 3.12 — ARCHITECTURE.md §7):
 *   - Access token lives in memory ONLY. It is NEVER written to localStorage,
 *     sessionStorage, or any persistent surface. This defeats XSS exfiltration.
 *   - User profile metadata may persist (cosmetic — "Welcome back, X"). The
 *     server is the source of truth; persisted user data is purely for UX
 *     during the silent-refresh window on page load.
 *   - hasHydrated guards the initial silent-refresh attempt — ProtectedRoute
 *     waits until hydration completes before deciding to redirect.
 *
 * State machine:
 *   { hasHydrated: false }                      // page just loaded
 *      → silent refresh kicks off (useAuthHydration)
 *   { hasHydrated: true, isAuthenticated: false }  // no valid session
 *   { hasHydrated: true, isAuthenticated: true, accessToken, user }
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

const initialState = {
  accessToken: null,    // in-memory only, never persisted
  user: null,           // { id, username, balance, created_at }
  isAuthenticated: false,
  hasHydrated: false,
};

export const useAuthStore = create(
  persist(
    (set) => ({
      ...initialState,

      // Called by login/register/refresh success handlers.
      setAuth: ({ accessToken, user }) =>
        set({
          accessToken,
          user,
          isAuthenticated: true,
        }),

      // Called by logout, 401 cascade, manual user action.
      clearAuth: () =>
        set({
          accessToken: null,
          user: null,
          isAuthenticated: false,
        }),

      // Called once by useAuthHydration when the initial refresh attempt completes.
      setHydrated: (value) => set({ hasHydrated: value }),

      // Partial update for things like balance changes pushed over WS.
      updateUser: (patch) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...patch } : state.user,
        })),
    }),
    {
      name: "hft-auth",
      // Only persist the user profile (cosmetic). Never persist the token.
      partialize: (state) => ({ user: state.user }),
    }
  )
);

// Non-hook accessors for use in interceptors / non-React contexts.
export const getAccessToken = () => useAuthStore.getState().accessToken;
export const getStoreState = () => useAuthStore.getState();
