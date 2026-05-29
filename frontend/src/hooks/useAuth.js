/**
 * useAuth — reactive hook over the Zustand authStore + service-level actions.
 *
 * Use this in components that need to react to auth state changes. For
 * one-shot imperative access (interceptors, services), call
 * `useAuthStore.getState()` directly.
 */

import { useNavigate } from "react-router-dom";

import {
  login as apiLogin,
  logout as apiLogout,
  register as apiRegister,
} from "../services/authService";
import { useAuthStore } from "../store/authStore";

export default function useAuth() {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);

  const navigate = useNavigate();

  async function login(credentials) {
    return apiLogin(credentials);
  }

  async function register(credentials) {
    return apiRegister(credentials);
  }

  async function logout(options = {}) {
    await apiLogout();
    if (options.redirect !== false) {
      navigate("/login", { replace: true });
    }
  }

  return {
    user,
    accessToken,
    isAuthenticated,
    hasHydrated,
    login,
    register,
    logout,
  };
}
