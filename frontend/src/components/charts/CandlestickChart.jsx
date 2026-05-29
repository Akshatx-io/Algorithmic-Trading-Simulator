import { useEffect, useMemo, useRef, useState } from "react";
import { createChart, CandlestickSeries } from "lightweight-charts";
import apiClient from "../../services/apiClient";

const safeNum = (n) => (typeof n === "number" && Number.isFinite(n) ? n : 0);

const toEpochSec = (v) => {
  if (typeof v === "number") {
    return v > 1_000_000_000_000 ? Math.floor(v / 1000) : Math.floor(v);
  }
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? Math.floor(t / 1000) : 0;
};

const normalizeCandles = (candles) =>
  (Array.isArray(candles) ? candles : [])
    .map((c) => ({
      time: toEpochSec(c.time),
      open: Number(c.open),
      high: Number(c.high),
      low: Number(c.low),
      close: Number(c.close),
    }))
    .filter(
      (c) =>
        c.time > 0 &&
        [c.open, c.high, c.low, c.close].every((v) => Number.isFinite(v))
    )
    .sort((a, b) => a.time - b.time);

const removeOutlierCandles = (candles) => {
  if (candles.length < 10) return candles;
  const closes = candles.map((c) => c.close).sort((a, b) => a - b);
  const mid = Math.floor(closes.length / 2);
  const median =
    closes.length % 2 === 0
      ? (closes[mid - 1] + closes[mid]) / 2
      : closes[mid];
  if (!Number.isFinite(median) || median <= 0) return candles;
  return candles.filter(
    (c) =>
      c.open > 0 &&
      c.high > 0 &&
      c.low > 0 &&
      c.close > 0 &&
      c.close >= median * 0.35 &&
      c.close <= median * 2.8
  );
};

const aggregateCandles = (candles, timeframe) => {
  const bucketSec = { "1m": 60, "5m": 300, "15m": 900 }[timeframe] || 60;
  if (bucketSec === 60) return candles.slice(-180);

  const buckets = new Map();
  for (const c of candles) {
    const t = Math.floor(c.time / bucketSec) * bucketSec;
    const prev = buckets.get(t);
    if (!prev) {
      buckets.set(t, { time: t, open: c.open, high: c.high, low: c.low, close: c.close });
    } else {
      prev.high = Math.max(prev.high, c.high);
      prev.low = Math.min(prev.low, c.low);
      prev.close = c.close;
    }
  }
  return Array.from(buckets.values()).sort((a, b) => a.time - b.time).slice(-180);
};

export default function CandlestickChart({ symbol, timeframe = "1m" }) {
  const chartRef = useRef(null);
  const containerRef = useRef(null);
  const seriesRef = useRef(null);
  const [baseCandles, setBaseCandles] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!symbol) return;
    let mounted = true;

    const fetchCandles = async () => {
      setLoading(true);
      try {
        const res = await apiClient.get(`/candles/${symbol}?timeframe=${timeframe}`);
        const normalized = removeOutlierCandles(
          normalizeCandles(res?.data?.candles)
        );
        if (mounted) setBaseCandles(normalized);
      } catch {
        if (mounted) setBaseCandles([]);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchCandles();
    const id = setInterval(fetchCandles, 3000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, [symbol, timeframe]);

  const candles = useMemo(
    () => aggregateCandles(baseCandles, timeframe),
    [baseCandles, timeframe]
  );

  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 2] || last;
  const lastPrice = safeNum(last?.close);
  const prevPrice = safeNum(prev?.close);
  const change = lastPrice - prevPrice;
  const changePct = prevPrice > 0 ? (change / prevPrice) * 100 : 0;

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: { background: { color: "#111827" }, textColor: "#9CA3AF" },
      grid: {
        vertLines: { color: "rgba(59,130,246,0.12)" },
        horzLines: { color: "rgba(59,130,246,0.12)" },
      },
      rightPriceScale: { borderColor: "#334155" },
      timeScale: { borderColor: "#334155", timeVisible: true, secondsVisible: false },
      crosshair: { mode: 1 },
      autoSize: true,
    });

    const seriesOptions = {
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderVisible: false,
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
      priceLineVisible: true,
      lastValueVisible: true,
    };

    // lightweight-charts API compatibility: v5 uses addSeries, older versions use addCandlestickSeries.
    const series =
      typeof chart.addCandlestickSeries === "function"
        ? chart.addCandlestickSeries(seriesOptions)
        : chart.addSeries(CandlestickSeries, seriesOptions);

    chartRef.current = chart;
    seriesRef.current = series;

    const ro = new ResizeObserver(() => {
      if (!containerRef.current || !chartRef.current) return;
      chartRef.current.applyOptions({
        width: containerRef.current.clientWidth,
        height: 300,
      });
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!seriesRef.current) return;
    if (!candles.length) {
      seriesRef.current.setData([]);
      return;
    }
    seriesRef.current.setData(candles);
    chartRef.current?.timeScale().fitContent();
  }, [candles]);

  if (!symbol) {
    return <div className="text-gray-400 text-center p-6">Select a symbol</div>;
  }

  return (
    <div className="bg-gray-900 p-4 rounded-xl border border-gray-800">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-white font-medium">{symbol} ({timeframe})</h3>
        <div className="text-right">
          <div className="text-white text-lg">₹{lastPrice.toFixed(2)}</div>
          <div className={change >= 0 ? "text-green-400" : "text-red-400"}>
            {change >= 0 ? "+" : ""}
            {change.toFixed(2)} ({changePct.toFixed(2)}%)
          </div>
        </div>
      </div>

      <div ref={containerRef} className="w-full h-[300px] rounded overflow-hidden" />

      {!loading && candles.length === 0 && (
        <div className="text-gray-400 text-center text-sm mt-3">
          No candle data available yet
        </div>
      )}
    </div>
  );
}