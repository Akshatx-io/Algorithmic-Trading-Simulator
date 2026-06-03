import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import useMarket from "../../hooks/useMarket";
import CandlestickChart from "../charts/CandlestickChart";
import AISignalPanel from "./AISignalPanel";
import Badge from "../ui/Badge";
import apiClient from "../../services/apiClient";
import { formatCurrency } from "../../utils/formatCurrency";

const safeNum = (n) => (typeof n === "number" && !Number.isNaN(n) ? n : 0);
const hasFiniteNumber = (n) => typeof n === "number" && Number.isFinite(n);

export default function StockDetailsPanel({ position }) {
  const navigate = useNavigate();
  const market = useMarket();

  const [timeframe, setTimeframe] = useState("1m");
  const [signalData, setSignalData] = useState(null);
  const [loadingSignal, setLoadingSignal] = useState(false);
  const [signalError] = useState(null);
  const lastSignalErrorLogRef = useRef(0);
  const abortRef = useRef(null);

  const symbol = position?.symbol;

  const live = useMemo(
    () => (Array.isArray(market) ? market.find((m) => m.symbol === symbol) : null),
    [market, symbol]
  );

  const currentPrice = safeNum(position?.current_price ?? live?.price ?? position?.avg_price);
  const change = safeNum(live?.change);
  const changePct = safeNum(live?.change_pct);
  const quantity = safeNum(position?.quantity);
  const avgPrice = safeNum(position?.avg_price);
  const marketValue = quantity * currentPrice;
  const totalCost = quantity * avgPrice;
  const unrealizedPnl = safeNum(position?.pnl) || (currentPrice - avgPrice) * quantity;
  const pnlPercentage =
    safeNum(position?.pnl_percentage) ||
    (avgPrice > 0 ? ((currentPrice - avgPrice) / avgPrice) * 100 : 0);

  useEffect(() => {
    if (!symbol) return;
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const fetchSignal = async () => {
      const hasLiveSignal = Boolean(live?.signal);
      const hasPositionSignal = Boolean(position?.signal);
      try {
        if (hasLiveSignal) {
          setSignalData((prev) => ({
            signal: live.signal,
            confidence: prev?.confidence ?? null,
            factors: prev?.factors ?? {},
            risk_metrics: prev?.risk_metrics ?? {},
            scores: prev?.scores ?? {},
          }));
        }
        if (!signalData) setLoadingSignal(true);
        const res = await apiClient.get(`/signals/${symbol}`, { signal: controller.signal });
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, live?.signal]);

  const signal = signalData?.signal || position?.signal || live?.signal || "HOLD";
  const factors = signalData?.factors || {};
  const riskMetrics = signalData?.risk_metrics || {};

  if (!position) {
    return (
      <div className="card card-pad text-center text-gray-400">
        Select a position to view details
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      {/* HEADER */}
      <div className="border-b border-line p-5">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">{symbol}</h2>
            <div className="mt-2 flex items-center gap-3">
              <span className="text-2xl font-semibold tnum text-white">{formatCurrency(currentPrice)}</span>
              <span className={`tnum ${change >= 0 ? "text-up" : "text-down"}`}>
                {change >= 0 ? "+" : ""}
                {change.toFixed(2)} ({changePct.toFixed(2)}%)
              </span>
            </div>
          </div>
          <button
            onClick={() => navigate("/trade")}
            className="rounded-lg bg-brand-gradient px-4 py-2 text-sm font-semibold text-white shadow-glow transition hover:opacity-90"
          >
            Trade
          </button>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <Badge variant={signal}>{signal}</Badge>
          {hasFiniteNumber(signalData?.confidence) && (
            <span className="text-sm text-gray-400">{signalData.confidence.toFixed(1)}% confidence</span>
          )}
        </div>
      </div>

      {/* POSITION DATA */}
      <div className="grid grid-cols-2 gap-4 p-5 text-sm">
        <Stat label="Shares" value={quantity} raw />
        <Stat label="Avg Price" value={avgPrice} />
        <Stat label="Market Value" value={marketValue} />
        <Stat label="Total Cost" value={totalCost} />
      </div>

      {/* PNL */}
      <div className="border-t border-line p-5">
        <div className="flex justify-between">
          <span className="text-gray-400">Unrealized P&L</span>
          <div className="text-right">
            <div className={`tnum ${unrealizedPnl >= 0 ? "text-up" : "text-down"}`}>
              {unrealizedPnl >= 0 ? "+" : ""}
              {formatCurrency(unrealizedPnl)}
            </div>
            <div className={`tnum text-sm ${pnlPercentage >= 0 ? "text-up" : "text-down"}`}>
              {pnlPercentage >= 0 ? "+" : ""}
              {pnlPercentage.toFixed(2)}%
            </div>
          </div>
        </div>
      </div>

      {/* TIMEFRAME */}
      <div className="flex gap-1 border-t border-line p-5 pb-0">
        <div className="flex gap-1 rounded-xl bg-ink-900 p-1">
          {["1m", "5m", "15m"].map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`rounded-lg px-3 py-1 text-sm font-medium transition ${
                timeframe === tf ? "bg-ink-700 text-white ring-1 ring-line" : "text-gray-400 hover:text-white"
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {/* CHART */}
      <div className="p-5">
        <CandlestickChart symbol={symbol} timeframe={timeframe} />
      </div>

      {/* AI PANEL */}
      <div className="border-t border-line p-5">
        <AISignalPanel
          signal={signal}
          confidence={signalData?.confidence}
          loading={loadingSignal}
          error={signalError}
        />
      </div>

      {/* FACTORS */}
      {signalData && (
        <div className="space-y-4 border-t border-line p-5">
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
}

function Stat({ label, value, raw }) {
  return (
    <div>
      <p className="text-gray-400">{label}</p>
      <p className="tnum text-white">{raw ? Number(value) : formatCurrency(Number(value))}</p>
    </div>
  );
}

function GridStat({ label, value }) {
  return (
    <div className="rounded-lg border border-line/70 bg-ink-900/60 p-3">
      <div className="text-xs text-gray-400">{label}</div>
      <div className="tnum text-white">
        {typeof value === "number" ? `${(value * 100).toFixed(1)}%` : "N/A"}
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <h4 className="mb-2 text-sm font-medium text-white">{title}</h4>
      <div className="grid grid-cols-2 gap-3">{children}</div>
    </div>
  );
}
