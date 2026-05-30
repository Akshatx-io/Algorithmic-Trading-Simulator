/**
 * TanStack Query client — singleton.
 *
 * Defaults tuned for a trading dashboard where:
 *   - Most data is push-fed by WebSocket (so refetchOnWindowFocus would be
 *     redundant and disruptive).
 *   - Server state has variable freshness needs — per-query staleTime
 *     overrides handle the rest.
 *
 * The WS→Query invalidation bridge (Phase 2.6) calls
 *   queryClient.invalidateQueries(['portfolio'])
 * directly when a `user.{id}.trade` event arrives, so we don't need
 * aggressive background polling here.
 */

import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Most queries: 30s stale window is enough for human-paced UI.
      staleTime: 30 * 1000,
      // Garbage-collect cache 5 min after last subscriber unmounts.
      gcTime: 5 * 60 * 1000,
      // Don't refetch when the tab regains focus — we have WS push.
      refetchOnWindowFocus: false,
      // One automatic retry on transient failure.
      retry: 1,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    },
    mutations: {
      // Mutations are user-initiated; surface failures immediately.
      retry: 0,
    },
  },
});
