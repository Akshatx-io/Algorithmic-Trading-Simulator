/**
 * Auth service — thin functional facade over the v1 auth API.
 *
 * Phase 2.1 (audit 3.11, 3.12):
 *   - All state writes go through the Zustand authStore.
 *   - localStorage is no longer used for the access token.
 *   - `isAuthenticated()` reads reactively from the store (callers that use
 *     it imperatively still work, but for true reactivity components should
 *     subscribe via `useAuthStore(s => s.isAuthenticated)`).
 *
 * Endpoints consumed:
 *   POST /auth/register  → { access_token, user, expires_in }
 *   POST /auth/login     → { access_token, user, expires_in }
 *   POST /auth/refresh   → { access_token, user, expires_in }  (cookie-based)
 *   POST /auth/logout    → 204
 *   POST /auth/ws-token  → { ws_token, expires_in }
 *   GET  /auth/me        → user
 */

import apiClient from "./apiClient";
import { useAuthStore } from "../store/authStore";

// ---------------------------------------------------------------------------
// Login / Register / Logout
// ---------------------------------------------------------------------------
export async function register({ username, password }) {
  const { data } = await apiClient.post("/auth/register", { username, password });
  useAuthStore.getState().setAuth({
    accessToken: data.access_token,
    user: data.user,
  });
  return data;
}

export async function login({ username, password }) {
  const { data } = await apiClient.post("/auth/login", { username, password });
  useAuthStore.getState().setAuth({
    accessToken: data.access_token,
    user: data.user,
  });
  return data;
}

export async function demoLogin() {
  const { data } = await apiClient.post("/auth/demo");
  useAuthStore.getState().setAuth({
    accessToken: data.access_token,
    user: data.user,
  });
  return data;
}

export async function logout() {
  try {
    await apiClient.post("/auth/logout");
  } catch {
    // The server-side revoke may legitimately 401 if the access token is
    // already expired. Either way, we clear local state.
  } finally {
    useAuthStore.getState().clearAuth();
  }
}

// ---------------------------------------------------------------------------
// Silent refresh + WS token
// ---------------------------------------------------------------------------
export async function silentRefresh() {
  // Returns { access_token, user, expires_in } on success.
  // Throws on no valid refresh cookie.
  const { data } = await apiClient.post("/auth/refresh");
  useAuthStore.getState().setAuth({
    accessToken: data.access_token,
    user: data.user,
  });
  return data;
}

export async function fetchWsToken() {
  const { data } = await apiClient.post("/auth/ws-token");
  return data; // { ws_token, expires_in }
}

export async function fetchMe() {
  const { data } = await apiClient.get("/auth/me");
  // Keep the store's user fresh (balance, email, etc.) without touching token.
  useAuthStore.getState().updateUser(data);
  return data;
}

export async function changePassword({ currentPassword, newPassword }) {
  const { data } = await apiClient.post("/auth/change-password", {
    current_password: currentPassword,
    new_password: newPassword,
  });
  return data;
}

// ---------------------------------------------------------------------------
// Back-compat helpers (kept so existing Login.jsx / App.jsx work unchanged)
// ---------------------------------------------------------------------------
export function isAuthenticated() {
  return useAuthStore.getState().isAuthenticated;
}

export function getCurrentUser() {
  return useAuthStore.getState().user;
}
