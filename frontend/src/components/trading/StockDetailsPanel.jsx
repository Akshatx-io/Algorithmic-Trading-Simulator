import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import useMarket from "../../hooks/useMarket";
import CandlestickChart from "../charts/CandlestickChart";
import AISignalPanel from "./AISignalPanel";
import apiClient from "../../services/apiClient";

// ===============================
// SIGNAL HELPERS (ELITE)
// ===============================
const getSignalColor = (signal) => {
  if (signal === "BUY") return "text-green-400";
  if (signal === "SELL") return "text-red-400";
  return "text-yellow-400";
};

const getSignalDot = (signal) => {
  if (signal === "BUY") return "bg-green-400";
  if (signal === "SELL") return "bg-red-400";
  return "bg-yellow-400";
};

// ===============================
// SAFE NUMBER UTILS
// ===============================
const safeNum = (n) => (typeof n === "number" && !isNaN(n) ? n : 0);
const hasFiniteNumber = (n) => typeof n === "number" && Number.isFinite(n);

// ===============================
// MAIN COMPONENT
// ===============================
const StockDetailsPanel = ({ position }) => {
  const navigate = useNavigate();
  const market = useMarket();

  const [timeframe, setTimeframe] = useState("1m");

  const [signalData, setSignalData] = useState(null);
  const [loadingSignal, setLoadingSignal] = useState(false);
  const [signalError, setSignalError] = useState(null);
  const lastSignalErrorLogRef = useRef(0);

  const abortRef = useRef(null);

  const symbol = position?.symbol;

  // ===============================
  // LIVE MARKET DATA (MEMOIZED)
  // ===============================
  const live = useMemo(
    () => market.find((m) => m.symbol === symbol),
    [market, symbol]
  );

  const currentPrice = safeNum(
    position?.current_price ?? live?.price ?? position?.avg_price
  );

  const change = safeNum(live?.change);
  const changePct = safeNum(live?.change_pct);

  const quantity = safeNum(position?.quantity);
  const avgPrice = safeNum(position?.avg_price);

  // ===============================
  // CALCULATIONS (SAFE)
  // ===============================
  const marketValue = quantity * currentPrice;
  const totalCost = quantity * avgPrice;

  const unrealizedPnl =
    safeNum(position?.pnl) ||
    (currentPrice - avgPrice) * quantity;

  const pnlPercentage =
    safeNum(position?.pnl_percentage) ||
    (avgPrice > 0
      ? ((currentPrice - avgPrice) / avgPrice) * 100
      : 0);

  // ===============================
  // SIGNAL FETCH (PRODUCTION SAFE)
  // ===============================
  useEffect(() => {
    if (!symbol) return;

    if (abortRef.current) {
      abortRef.current.abort();
    }

    const controller = new AbortController();
    abortRef.current = controller;

    const fetchSignal = async () => {
      const hasLiveSignal = Boolean(live?.signal);
      const hasPositionSignal = Boolean(position?.signal);
      try {
        // 🔥 FIRST TRY WS DATA
        if (hasLiveSignal) {
          setSignalData((prev) => ({
            signal: live.signal,
            confidence: prev?.confidence ?? null,
            factors: prev?.factors ?? {},
            risk_metrics: prev?.risk_metrics ?? {},
            scores: prev?.scores ?? {},
          }));
        }

        // Only show loader until first successful hydration.
        if (!signalData) {
          setLoadingSignal(true);
        }
        setSignalError(null);

        const res = await apiClient.get(`/signals/${symbol}`, {
          signal: controller.signal,
        });
        setSignalData((prev) => ({
          ...prev,
          ...res.data,
          signal: live?.signal ?? res.data?.signal ?? prev?.signal ?? "HOLD",
        }));

      } catch (err) {
        if (err.name !== "AbortError") {
          const now = Date.now();
          if (now - lastSignalErrorLogRef.current > 15000) {
            console.warn("Signal fetch unavailable, using fallback signal state");
            lastSignalErrorLogRef.current = now;
          }
          // Keep UI stable with HOLD fallback; avoid transient error banners.
          if (!hasLiveSignal && !hasPositionSignal && !signalData) {
            setSignalData((prev) => prev || { signal: "HOLD", confidence: null });
          }
        }
      } finally {
        setLoadingSignal(false);
      }
    };

    fetchSignal();

    return () => controller.abort();
  }, [symbol, live?.signal]);

  // ===============================
  // FINAL SIGNAL
  // ===============================
  const signal =
    signalData?.signal ||
    position?.signal ||
    live?.signal ||
    "HOLD";

  const signalColor = getSignalColor(signal);
  const signalDot = getSignalDot(signal);

  const factors = signalData?.factors || {};
  const scores = signalData?.scores || {};
  const riskMetrics = signalData?.risk_metrics || {};

  // ===============================
  // EMPTY STATE
  // ===============================
  if (!position) {
    return (
      <div className="bg-gray-900 p-6 rounded-xl text-center text-gray-400">
        Select a position to view details
      </div>
    );
  }

  // ===============================
  // UI
  // ===============================
  return (
    <div className="bg-gray-900 rounded-xl overflow-hidden">

      {/* HEADER */}
      <div className="p-6 border-b border-gray-800">
        <div className="flex justify-between items-start">

          <div>
            <h2 className="text-xl font-bold text-white">{symbol}</h2>

            <div className="flex items-center gap-3 mt-2">
              <span className="text-2xl text-white">
                ${currentPrice.toFixed(2)}
              </span>

              <span className={change >= 0 ? "text-green-400" : "text-red-400"}>
                {change >= 0 ? "+" : ""}
                {change.toFixed(2)} ({changePct.toFixed(2)}%)
              </span>
            </div>
          </div>

          <button
            onClick={() => navigate("/trade")}
            className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded text-white"
          >
            Trade
          </button>
        </div>

        {/* SIGNAL DISPLAY */}
        <div className="mt-4 flex items-center gap-3">

          <div className={`w-3 h-3 rounded-full ${signalDot}`} />

          <span className={`font-semibold ${signalColor}`}>
            {signal}
          </span>

          {hasFiniteNumber(signalData?.confidence) && (
            <span className="text-gray-400 text-sm">
              {signalData.confidence.toFixed(1)}%
            </span>
          )}
        </div>
      </div>

      {/* POSITION DATA */}
      <div className="p-4 grid grid-cols-2 gap-4 text-sm">
        <Stat label="Shares" value={quantity} />
        <Stat label="Avg Price" value={avgPrice} />
        <Stat label="Market Value" value={marketValue} />
        <Stat label="Total Cost" value={totalCost} />
      </div>

      {/* PNL */}
      <div className="p-4 border-t border-gray-800">
        <div className="flex justify-between">
          <span className="text-gray-400">Unrealized P&L</span>

          <div className="text-right">
            <div className={unrealizedPnl >= 0 ? "text-green-400" : "text-red-400"}>
              ${unrealizedPnl.toFixed(2)}
            </div>

            <div className={pnlPercentage >= 0 ? "text-green-400" : "text-red-400"}>
              {pnlPercentage.toFixed(2)}%
            </div>
          </div>
        </div>
      </div>

      {/* TIMEFRAME */}
      <div className="p-4 border-t border-gray-800 flex gap-2">
        {["1m", "5m", "15m"].map((tf) => (
          <button
            key={tf}
            onClick={() => setTimeframe(tf)}
            className={`px-3 py-1 rounded ${
              timeframe === tf
                ? "bg-blue-600 text-white"
                : "bg-gray-700 text-gray-300"
            }`}
          >
            {tf}
          </button>
        ))}
      </div>

      {/* CHART */}
      <div className="p-4">
        <CandlestickChart
          symbol={symbol}
          timeframe={timeframe}
        />
      </div>

      {/* AI PANEL */}
      <div className="p-4 border-t border-gray-800">
        <AISignalPanel
          signal={signal}
          confidence={signalData?.confidence}
          loading={loadingSignal}
          error={signalError}
        />
      </div>

      {/* FACTORS */}
      {signalData && (
        <div className="p-4 border-t border-gray-800 space-y-4">

          <Section title="Trading Factors">
            <GridStat label="Trend" value={factors.trend} />
            <GridStat label="Momentum" value={factors.momentum} />
            <GridStat label="Volatility" value={factors.volatility} />
          </Section>

          <Section title="Risk Metrics">
            <GridStat label="Sharpe" value={riskMetrics.sharpe_ratio} />
            <GridStat label="Drawdown" value={riskMetrics.max_drawdown} />
            <GridStat label="Volatility" value={riskMetrics.volatility} />
          </Section>

        </div>
      )}
    </div>
  );
};

// ===============================
// SUB COMPONENTS
// ===============================
const Stat = ({ label, value }) => (
  <div>
    <p className="text-gray-400">{label}</p>
    <p className="text-white">{Number(value).toFixed(2)}</p>
  </div>
);

const GridStat = ({ label, value }) => (
  <div className="bg-gray-800 p-3 rounded">
    <div className="text-gray-400 text-xs">{label}</div>
    <div className="text-white">
      {typeof value === "number"
        ? (value * 100).toFixed(1) + "%"
        : "N/A"}
    </div>
  </div>
);

const Section = ({ title, children }) => (
  <div>
    <h4 className="text-white mb-2">{title}</h4>
    <div className="grid grid-cols-2 gap-3">{children}</div>
  </div>
);

export default StockDetailsPanel;