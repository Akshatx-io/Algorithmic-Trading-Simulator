/**
 * useAuthHydration — silent refresh on first app mount.
 *
 * On page load, the access token is gone (it lives only in memory). If the
 * user has a valid refresh cookie, we should still consider them logged in.
 * This hook fires a single /auth/refresh attempt and toggles `hasHydrated`
 * regardless of outcome. ProtectedRoute waits on `hasHydrated` to avoid a
 * "flash of unauthenticated content" → redirect → re-auth cycle.
 */

import { useEffect } from "react";

import { silentRefresh } from "../services/authService";
import { useAuthStore } from "../store/authStore";

export default function useAuthHydration() {
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const setHydrated = useAuthStore((s) => s.setHydrated);

  useEffect(() => {
    if (hasHydrated) return;

    let cancelled = false;

    (async () => {
      try {
        await silentRefresh();
      } catch {
        // No valid refresh cookie — user is unauthenticated. Normal path.
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hasHydrated, setHydrated]);

  return hasHydrated;
}
