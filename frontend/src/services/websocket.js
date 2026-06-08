/**
 * WebSocket engine — minimal Phase 2.1 update to read the access token from
 * the Zustand authStore instead of localStorage (audit 3.11/3.12).
 *
 * Phase 2.5 ships the v2 protocol (topic-based subscriptions, envelope
 * versioning, server-driven heartbeats, single-flight WS token fetch via
 * /auth/ws-token). This file is the bridge implementation.
 */

import { getAccessToken, useAuthStore } from "../store/authStore";

class WebSocketEngine {
  constructor() {
    this.socket = null;

    this.listeners = new Map(); // eventType -> Set(callback)
    this.globalListeners = new Set();

    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 20;

    this.reconnectTimer = null;
    this.heartbeatInterval = null;

    this.messageQueue = [];

    this.isConnected = false;
    this.isConnecting = false;

    // Same-origin by default: derive ws/wss + host from the page URL so the
    // app works in production (served by FastAPI) and in dev (Vite proxy)
    // without any build-time env. Override with VITE_WS_URL if needed.
    this.baseURL =
      import.meta.env.VITE_WS_URL ||
      (typeof window !== "undefined"
        ? `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/api/v1/ws`
        : "ws://localhost:8000/api/v1/ws");
  }

  // Reads from the Zustand store. Phase 2.5 swaps this for a short-lived
  // token minted by /auth/ws-token.
  getToken() {
    return getAccessToken();
  }

  isTokenExpired(token) {
    if (!token) return true;
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      if (!payload?.exp) return false;
      return Date.now() >= payload.exp * 1000;
    } catch {
      return true;
    }
  }

  connect() {
    if (this.isConnected || this.isConnecting) return;

    const token = this.getToken();
    if (!token || this.isTokenExpired(token)) {
      console.warn("[ws] connect aborted: no valid access token");
      return;
    }

    this.isConnecting = true;

    this.socket = new WebSocket(`${this.baseURL}?token=${token}`);

    this.socket.onopen = () => {
      console.log("✅ WS Connected");

      this.isConnected = true;
      this.isConnecting = false;
      this.reconnectAttempts = 0;

      this.flushQueue();
      this.startHeartbeat();

      // 🔥 IMPORTANT: subscribe channel
      this.send({
        type: "subscribe",
        channel: "market",
      });
    };

    this.socket.onmessage = (event) => {
      this.handleMessage(event);
    };

    this.socket.onclose = (evt) => {
      console.warn("⚠️ WS Closed");

      this.isConnected = false;
      this.isConnecting = false;

      this.cleanup();
      // Don't reconnect on auth-policy closure; route guard / apiClient
      // interceptor handles re-auth via /auth/refresh.
      if (evt?.code === 1008 || evt?.code === 4401) {
        useAuthStore.getState().clearAuth();
        return;
      }
      if (!this.getToken() || this.isTokenExpired(this.getToken())) {
        return;
      }
      this.scheduleReconnect();
    };

    this.socket.onerror = (err) => {
      console.error("❌ WS Error:", err);
      this.socket.close();
    };
  }

  // ===============================
  // MESSAGE HANDLER (NORMALIZED)
  // ===============================
  handleMessage(event) {
    try {
      const data = JSON.parse(event.data);

      const type = data.type || "unknown";

      // 🔥 normalize payload
      const payload =
        data.payload ||
        data.data ||
        data;

      // specific listeners
      if (this.listeners.has(type)) {
        this.listeners.get(type).forEach((cb) => {
          try {
            cb(payload);
          } catch (e) {
            console.error("Listener error:", e);
          }
        });
      }

      // global listeners
      this.globalListeners.forEach((cb) => {
        try {
          cb({ type, payload });
        } catch (e) {
          console.error("Global listener error:", e);
        }
      });

    } catch (e) {
      console.error("❌ WS Parse Error:", e);
    }
  }

  // ===============================
  // SUBSCRIBE (TYPE-SAFE)
  // ===============================
  subscribe(type, callback) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }

    this.listeners.get(type).add(callback);

    return () => {
      this.listeners.get(type)?.delete(callback);
    };
  }

  subscribeAll(callback) {
    this.globalListeners.add(callback);

    return () => {
      this.globalListeners.delete(callback);
    };
  }

  // ===============================
  // SEND (QUEUE SAFE)
  // ===============================
  send(data) {
    if (!this.isConnected) {
      this.messageQueue.push(data);
      return;
    }

    try {
      this.socket.send(JSON.stringify(data));
    } catch (e) {
      console.error("WS send failed:", e);
    }
  }

  flushQueue() {
    while (this.messageQueue.length > 0) {
      this.send(this.messageQueue.shift());
    }
  }

  // ===============================
  // HEARTBEAT
  // ===============================
  startHeartbeat() {
    this.stopHeartbeat();

    this.heartbeatInterval = setInterval(() => {
      this.send({ type: "ping" });
    }, 8000);
  }

  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  // ===============================
  // RECONNECT (EXPONENTIAL + SAFE)
  // ===============================
  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error("❌ WS Max reconnect attempts reached");
      return;
    }

    const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 20000);

    this.reconnectAttempts++;

    this.reconnectTimer = setTimeout(() => {
      console.log(`🔁 WS Reconnecting... attempt ${this.reconnectAttempts}`);
      this.connect();
    }, delay);
  }

  // ===============================
  // CLEANUP
  // ===============================
  cleanup() {
    this.stopHeartbeat();

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  disconnect() {
    this.cleanup();

    if (this.socket) {
      this.socket.close();
    }

    this.listeners.clear();
    this.globalListeners.clear();

    this.socket = null;
    this.isConnected = false;
    this.isConnecting = false;
  }
}

// ===============================
export default new WebSocketEngine();