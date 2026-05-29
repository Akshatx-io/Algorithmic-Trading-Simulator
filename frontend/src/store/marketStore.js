// ===============================
// GLOBAL MARKET STORE (HFT-GRADE)
// ===============================

class MarketStore {
  constructor() {
    this.data = new Map();     // O(1) lookup
    this.subscribers = new Set();
  }

  // ===============================
  // UPDATE SINGLE SYMBOL
  // ===============================
  update(symbol, payload) {
    this.data.set(symbol, {
      ...(this.data.get(symbol) || {}),
      ...payload,
      lastUpdate: Date.now(),
    });

    this.notify();
  }

  // ===============================
  // BULK UPDATE (IMPORTANT)
  // ===============================
  bulkUpdate(dataArray) {
    if (!Array.isArray(dataArray)) return;

    dataArray.forEach((item) => {
      if (!item?.symbol) return;

      this.update(item.symbol, item);
    });
  }

  // ===============================
  // GET ALL DATA
  // ===============================
  getAll() {
    return Array.from(this.data.values());
  }

  // ===============================
  // SUBSCRIBE
  // ===============================
  subscribe(callback) {
    this.subscribers.add(callback);

    // immediate sync
    callback(this.getAll());

    return () => {
      this.subscribers.delete(callback);
    };
  }

  // ===============================
  // NOTIFY
  // ===============================
  notify() {
    const snapshot = this.getAll();

    this.subscribers.forEach((cb) => {
      try {
        cb(snapshot);
      } catch (e) {
        console.error("MarketStore subscriber error:", e);
      }
    });
  }

  // ===============================
  // RESET (OPTIONAL)
  // ===============================
  clear() {
    this.data.clear();
    this.notify();
  }
}

const marketStore = new MarketStore();
export default marketStore;