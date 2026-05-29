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
    throw new Error(err.message || "Trade failed");
  }
};

// ===============================
// GET TRADES
// ===============================
export const getTrades = async () => {
  const res = await apiClient.get("/trades");
  return res.data;
};