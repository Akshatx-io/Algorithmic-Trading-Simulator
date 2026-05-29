/**
 * Axios instance — Phase 2.1.
 *
 * Wiring:
 *   - Access token read from the Zustand authStore (not localStorage).
 *   - Refresh-token cookie ridden along automatically (withCredentials: true).
 *   - On 401, performs a single-flight silent refresh, then retries the
 *     original request once. If refresh fails, clears the store and bounces
 *     to /login.
 *   - Every mutating request carries an `X-Idempotency-Key` UUID (the server
 *     wires the corresponding store in Phase 2.4).
 *
 * Single-flight refresh:
 *   Multiple in-flight requests can simultaneously receive 401 (e.g. a page
 *   loaded after the access token expired). They all await the same refresh
 *   promise — only one network call is made.
 */

import axios from "axios";

import { useAuthStore } from "../store/authStore";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1";

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20_000,
  withCredentials: true, // required so the refresh cookie rides along
  headers: { "Content-Type": "application/json" },
});

// ---------------------------------------------------------------------------
// Request interceptor
// ---------------------------------------------------------------------------
apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  const method = (config.method || "get").toLowerCase();
  if (["post", "put", "patch", "delete"].includes(method)) {
    if (!config.headers["X-Idempotency-Key"]) {
      config.headers["X-Idempotency-Key"] = crypto.randomUUID();
    }
  }

  return config;
});

// ---------------------------------------------------------------------------
// Single-flight refresh
// ---------------------------------------------------------------------------
let refreshInFlight = null;

async function performSilentRefresh() {
  // Use a bare axios instance so we don't recurse through this interceptor.
  const bare = axios.create({
    baseURL: API_BASE_URL,
    timeout: 10_000,
    withCredentials: true,
    headers: { "Content-Type": "application/json" },
  });
  const { data } = await bare.post("/auth/refresh");
  if (!data?.access_token || !data?.user) {
    throw new Error("Malformed refresh response");
  }
  useAuthStore.getState().setAuth({
    accessToken: data.access_token,
    user: data.user,
  });
  return data;
}

function getRefreshPromise() {
  if (!refreshInFlight) {
    refreshInFlight = performSilentRefresh().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

// ---------------------------------------------------------------------------
// Response interceptor
// ---------------------------------------------------------------------------
apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (!error.response) {
      return Promise.reject({
        message: "Network error. Backend unreachable.",
        kind: "network",
        original: error,
      });
    }

    const status = error.response.status;
    const original = error.config || {};

    // Never try to refresh the refresh endpoint itself.
    const isAuthEndpoint = (original.url || "").includes("/auth/");

    if (status === 401 && !original._retried && !isAuthEndpoint) {
      original._retried = true;
      try {
        const data = await getRefreshPromise();
        original.headers = original.headers || {};
        original.headers.Authorization = `Bearer ${data.access_token}`;
        return apiClient(original);
      } catch {
        useAuthStore.getState().clearAuth();
        if (
          typeof window !== "undefined" &&
          window.location.pathname !== "/login"
        ) {
          window.location.href = "/login";
        }
        return Promise.reject({
          message: "Session expired. Please log in again.",
          status: 401,
          kind: "auth",
        });
      }
    }

    return Promise.reject({
      message:
        error.response.data?.detail ||
        error.response.data?.message ||
        `Request failed (${status})`,
      status,
      kind: "api",
      data: error.response.data,
    });
  }
);

export default apiClient;
