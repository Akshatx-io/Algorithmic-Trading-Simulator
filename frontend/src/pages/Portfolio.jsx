import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { RefreshCw, RotateCcw, Wallet, TrendingUp, Banknote, Percent } from "lucide-react";

import usePortfolio from "../hooks/usePortfolio";
import useMarket from "../hooks/useMarket";

import AllocationPie from "../components/charts/AllocationPie";
import StockDetailsPanel from "../components/trading/StockDetailsPanel";
import LoadingSpinner from "../components/common/LoadingSpinner";
import ErrorMessage from "../components/common/ErrorMessage";
import StatCard from "../components/ui/StatCard";
import Card, { CardHeader } from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import apiClient from "../services/apiClient";
import { resetAccount } from "../services/portfolioService";
import { formatCurrency } from "../utils/formatCurrency";

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export default function Portfolio() {
  const navigate = useNavigate();
  const { portfolio, loading, error, refresh } = usePortfolio();
  const market = useMarket();

  const [selectedSymbol, setSelectedSymbol] = useState(null);
  const [busy, setBusy] = useState(false);
  const [marketSnapshot, setMarketSnapshot] = useState({});
  const [signalSnapshot, setSignalSnapshot] = useState({});

  const positions = useMemo(
    () => portfolio?.positions || [],
    [portfolio]
  );

  // Stable key so the snapshot poller only re-subscribes when the symbol set changes.
  const symbolsKey = useMemo(
    () => [...new Set(positions.map((p) => p.symbol).filter(Boolean))].sort().join(","),
    [positions]
  );

  // Authoritative quote + signal snapshots (avoid raw WS flicker in the table).
  useEffect(() => {
    if (!symbolsKey) return;
    const symbols = symbolsKey.split(",");
    let mounted = true;

    const tick = async () => {
      try {
        const [quotes, signalRes] = await Promise.all([
          Promise.all(
            symbols.map((s) =>
              apiClient.get(`/market/${s}`).then((r) => r.data).catch(() => null)
            )
          ),
          apiClient.get("/signals").then((r) => r.data).catch(() => null),
        ]);
        if (!mounted) return;
        const nextMarket = {};
        quotes.forEach((row) => row?.symbol && (nextMarket[row.symbol] = num(row.price)));
        setMarketSnapshot(nextMarket);
        const nextSignals = {};
        (signalRes?.signals || []).forEach((sig) => {
          if (sig?.symbol) {
            nextSignals[sig.symbol] = { signal: sig.signal || "HOLD", confidence: num(sig.confidence) };
          }
        });
        setSignalSnapshot(nextSignals);
      } catch {
        /* keep last good snapshot */
      }
    };

    tick();
    const id = setInterval(tick, 5000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, [symbolsKey]);

  const marketMap = useMemo(() => {
    const map = {};
    (Array.isArray(market) ? market : []).forEach((m) => m?.symbol && (map[m.symbol] = m));
    return map;
  }, [market]);

  const merged = useMemo(() => {
    return positions.map((pos) => {
      const live = marketMap[pos.symbol];
      const quantity = num(pos.quantity);
      const avgPrice = num(pos.avg_price);
      const price = num(marketSnapshot[pos.symbol] ?? pos.current_price ?? pos.avg_price);
      const info = signalSnapshot[pos.symbol];
      const signal = live?.signal ?? info?.signal ?? pos.signal ?? "HOLD";
      const pnl = (price - avgPrice) * quantity;
      return {
        ...pos,
        quantity,
        avg_price: avgPrice,
        current_price: price,
        market_value: quantity * price,
        pnl,
        pnl_percentage: avgPrice > 0 ? ((price - avgPrice) / avgPrice) * 100 : 0,
        signal,
        signal_confidence: num(info?.confidence),
        candles: Array.isArray(live?.candles) ? live.candles : [],
      };
    });
  }, [positions, marketMap, marketSnapshot, signalSnapshot]);

  const selected = useMemo(() => {
    if (!merged.length) return null;
    return merged.find((p) => p.symbol === selectedSymbol) || merged[0];
  }, [merged, selectedSymbol]);

  const totals = useMemo(() => {
    const p = portfolio || {};
    const marketValue = merged.reduce((a, x) => a + num(x.market_value), 0);
    const unrealized = merged.reduce((a, x) => a + num(x.pnl), 0);
    const equity = num(p.total_equity || marketValue);
    const cash = num(p.cash_balance);
    const totalPnl = num(p.total_pnl ?? unrealized + num(p.realized_pnl));
    const invested = equity - unrealized;
    const pct = invested > 0 ? (unrealized / invested) * 100 : 0;
    return { equity, cash, unrealized, totalPnl, pct };
  }, [portfolio, merged]);

  const handleRefresh = async () => {
    setBusy(true);
    await refresh?.().catch(() => {});
    setBusy(false);
  };

  const handleReset = async () => {
    if (!window.confirm("Reset account? This permanently clears all positions, trades, and history, and restores your starting balance.")) {
      return;
    }
    setBusy(true);
    try {
      await resetAccount();
      setSelectedSymbol(null);
      await refresh?.().catch(() => {});
      toast.success("Account reset to starting balance");
    } catch {
      toast.error("Reset failed");
    } finally {
      setBusy(false);
    }
  };

  if (loading && !portfolio?.positions?.length && !positions.length) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} onRetry={handleRefresh} />;

  if (!positions.length) {
    return (
      <Card className="card-pad mx-auto max-w-lg text-center">
        <h3 className="text-lg font-semibold text-white">No positions yet</h3>
        <p className="mt-1 text-sm text-gray-400">
          Build your portfolio by placing your first simulated trade.
        </p>
        <button
          onClick={() => navigate("/trade")}
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand-gradient px-5 py-2.5 text-sm font-semibold text-white shadow-glow transition hover:opacity-90"
        >
          Start Trading
        </button>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* SUMMARY */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Equity" value={formatCurrency(totals.equity)} icon={Wallet} />
        <StatCard label="Cash" value={formatCurrency(totals.cash)} icon={Banknote} accent="accent" />
        <StatCard
          label="Unrealized P&L"
          value={formatCurrency(totals.unrealized)}
          tone={totals.unrealized >= 0 ? "up" : "down"}
          icon={TrendingUp}
        />
        <StatCard
          label="Return"
          value={`${totals.pct.toFixed(2)}%`}
          tone={totals.pct >= 0 ? "up" : "down"}
          icon={Percent}
          accent="accent"
        />
      </div>

      {/* ACTIONS */}
      <div className="flex items-center justify-end gap-2">
        <button
          onClick={handleRefresh}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-lg border border-line bg-ink-800 px-3 py-1.5 text-sm text-gray-300 transition hover:text-white disabled:opacity-50"
        >
          <RefreshCw size={14} className={busy ? "animate-spin" : ""} /> Refresh
        </button>
        <button
          onClick={handleReset}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-lg border border-down/40 bg-down/10 px-3 py-1.5 text-sm text-down transition hover:bg-down/20 disabled:opacity-50"
        >
          <RotateCcw size={14} /> Reset
        </button>
      </div>

      {/* CONTENT */}
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-3">
        <div className="min-w-0 space-y-6 xl:col-span-2">
          <AllocationPie
            positions={merged}
            onSelect={(pos) => setSelectedSymbol(pos?.symbol || null)}
          />

          <Card>
            <CardHeader title="Open Positions" subtitle={`${merged.length} holding(s)`} />
            <div className="overflow-x-auto px-2 pb-2 pt-3">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                    <th className="px-3 py-2 font-medium">Symbol</th>
                    <th className="px-3 py-2 text-right font-medium">Qty</th>
                    <th className="px-3 py-2 text-right font-medium">Avg</th>
                    <th className="px-3 py-2 text-right font-medium">Price</th>
                    <th className="px-3 py-2 text-right font-medium">Value</th>
                    <th className="px-3 py-2 text-right font-medium">P&L</th>
                    <th className="px-3 py-2 text-right font-medium">Signal</th>
                  </tr>
                </thead>
                <tbody>
                  {merged.map((p) => {
                    const isSel = selected?.symbol === p.symbol;
                    return (
                      <tr
                        key={p.symbol}
                        onClick={() => setSelectedSymbol(p.symbol)}
                        className={`cursor-pointer border-t border-line/60 transition ${
                          isSel ? "bg-brand-500/10" : "hover:bg-ink-700/40"
                        }`}
                      >
                        <td className="px-3 py-2.5 font-semibold text-white">{p.symbol}</td>
                        <td className="px-3 py-2.5 text-right tnum text-gray-300">{p.quantity}</td>
                        <td className="px-3 py-2.5 text-right tnum text-gray-300">{formatCurrency(p.avg_price)}</td>
                        <td className="px-3 py-2.5 text-right tnum text-gray-300">{formatCurrency(p.current_price)}</td>
                        <td className="px-3 py-2.5 text-right tnum text-gray-300">{formatCurrency(p.market_value)}</td>
                        <td className="px-3 py-2.5 text-right">
                          <span className={p.pnl >= 0 ? "text-up tnum" : "text-down tnum"}>
                            {p.pnl >= 0 ? "+" : ""}
                            {formatCurrency(p.pnl)}
                            <span className="ml-1 text-xs text-gray-500">
                              ({p.pnl_percentage >= 0 ? "+" : ""}
                              {p.pnl_percentage.toFixed(2)}%)
                            </span>
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <Badge variant={p.signal}>{p.signal}</Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <div className="min-w-0">
          <StockDetailsPanel position={selected} />
        </div>
      </div>
    </div>
  );
}
