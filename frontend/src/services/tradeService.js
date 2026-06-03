import apiClient from "./apiClient";


// ===============================
// EVENT EMITTER (SIMPLE PUB/SUB)
// ===============================
const listeners = new Set();

export const subscribeTradeUpdates = (cb) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

const notify = () => {
  listeners.forEach((cb) => cb());
};

// ===============================
// EXECUTE TRADE
// ===============================
export const executeTrade = async (data) => {
  try {
    const res = await apiClient.post("/trades", data);
    notify();
    return res.data;
  } catch (err) {
    // Surface the backend's human-readable reason (e.g. "Risk limit exceeded",
    // "Not enough shares", "Invalid market price") instead of a generic message.
    const detail =
      err?.response?.data?.detail ||
      err?.response?.data?.message ||
      err?.message ||
      "Trade failed";
    throw new Error(typeof detail === "string" ? detail : "Trade failed");
  }
};

// ===============================
// GET TRADES
// ===============================
export const getTrades = async () => {
  const res = await apiClient.get("/trades");
  return res.data;
};