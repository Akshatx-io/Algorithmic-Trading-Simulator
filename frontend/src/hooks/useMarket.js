import { useEffect, useState, useRef } from "react";
import wsEngine from "../services/websocket";

// ===============================
// CONFIG
// ===============================
const MAX_SYMBOLS = 200;
const UPDATE_THROTTLE_MS = 100;
const MAX_ALLOWED_TICK_MOVE = 0.35; // 35% jump guard against bad ticks

// ===============================
// ELITE MARKET HOOK (REAL-TIME)
// ===============================
const useMarket = () => {
  const [data, setData] = useState([]);

  const bufferRef = useRef({});
  const lastUpdateRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    wsEngine.connect();

    // ===============================
    // 🔥 HANDLE BATCH UPDATES
    // ===============================
    const mergeUpdates = (payload) => {
      const updates = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.data)
        ? payload.data
        : [];

      updates.forEach((item) => {
        if (!item?.symbol) return;
        const prev = bufferRef.current[item.symbol] || {};
        const nextPrice = Number(item.price);
        const prevPrice = Number(prev.price);

        // Reject invalid/erratic prices while preserving previous stable values.
        if (Number.isFinite(nextPrice) && nextPrice > 0 && Number.isFinite(prevPrice) && prevPrice > 0) {
          const move = Math.abs(nextPrice - prevPrice) / prevPrice;
          if (move > MAX_ALLOWED_TICK_MOVE) {
            item = { ...item, price: prevPrice };
          }
        } else if (!Number.isFinite(nextPrice) || nextPrice <= 0) {
          item = { ...item, price: Number.isFinite(prevPrice) ? prevPrice : undefined };
        }

        // Merge updates so partial packets do not wipe candles/signal fields.
        bufferRef.current[item.symbol] = { ...prev, ...item };
      });
    };

    const unsubBatch = wsEngine.subscribe("market_batch", (payload) => {
      mergeUpdates(payload);
    });

    // ===============================
    // 🔥 HANDLE STREAM UPDATES
    // ===============================
    const unsubStream = wsEngine.subscribe("market_update", (payload) => {
      mergeUpdates(payload);
    });

    // ===============================
    // 🔥 RENDER LOOP (THROTTLED)
    // ===============================
    const interval = setInterval(() => {
      const now = Date.now();

      if (now - lastUpdateRef.current < UPDATE_THROTTLE_MS) return;

      lastUpdateRef.current = now;

      if (mountedRef.current) {
        const values = Object.values(bufferRef.current)
          .slice(0, MAX_SYMBOLS)
          .sort((a, b) => String(a.symbol).localeCompare(String(b.symbol)));
        if (values.length > 0) {
          setData(values);
        }
      }
    }, UPDATE_THROTTLE_MS);

    // ===============================
    // CLEANUP
    // ===============================
    return () => {
      mountedRef.current = false;

      clearInterval(interval);
      unsubBatch();
      unsubStream();
    };
  }, []);

  return data;
};

export default useMarket;