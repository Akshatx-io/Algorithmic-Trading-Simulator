/**
 * Dashboard page.
 *
 * Composes:
 * - Portfolio summary metrics
 * - Live market ticker (WebSocket-fed)
 * - Equity curve chart
 * - Positions list
 *
 * Phase 2.0 changes:
 * - Removed the commented-out first version of this file (~160 lines).
 *
 * Outstanding (Phase 2.6):
 * - Replace `useMarket` / `usePortfolio` / `usePerformance` hand-rolled hooks
 *   with TanStack Query + a Zustand market store.
 * - Use a currency formatter parameterized by symbol metadata (current code
 *   prefixes USD-denominated tickers with `₹`, audit finding 6.9).
 * - Wrap each section in its own ErrorBoundary.
 */

import { useMemo } from "react";

import EquityChart       from "../components/charts/EquityChart";
import LoadingSpinner    from "../components/common/LoadingSpinner";
import usePerformance    from "../hooks/usePerformance";
import usePortfolio      from "../hooks/usePortfolio";
import { formatCurrency } from "../utils/formatCurrency";

// ---- helpers ---------------------------------------------------------------

const safeNumber = (n) =>
  typeof n === "number" && !Number.isNaN(n) ? n : 0;

// ---- components ------------------------------------------------------------

function MetricCard({ title, value, highlight }) {
  const val = safeNumber(value);

  const color = highlight
    ? val >= 0
      ? "text-green-400"
      : "text-red-400"
    : "text-white";

  return (
    <div className="bg-gray-900 p-5 rounded-xl border border-gray-800">
      <p className="text-gray-400 text-sm">{title}</p>
      <p className={`text-xl font-semibold ${color}`}>{formatCurrency(val)}</p>
    </div>
  );
}

// ---- page ------------------------------------------------------------------

export default function Dashboard() {
  const { portfolio, loading, error } = usePortfolio();
  const perf   = usePerformance();

  const { positions, equity, pnl, unrealized, realized } = useMemo(() => {
    const p = portfolio || {};
    return {
      positions:  Array.isArray(p.positions) ? p.positions : [],
      equity:     safeNumber(p.total_equity),
      pnl:        safeNumber(p.total_pnl),
      unrealized: safeNumber(p.unrealized_pnl),
      realized:   safeNumber(p.realized_pnl),
    };
  }, [portfolio]);

  const sharpe = safeNumber(perf?.metrics?.sharpe_ratio);

  if (loading) return <LoadingSpinner />;
  if (error)   return <div className="p-6 text-red-400">{error}</div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <MetricCard title="Equity"     value={equity} />
        <MetricCard title="PnL"        value={pnl}        highlight />
        <MetricCard title="Unrealized" value={unrealized} highlight />
        <MetricCard title="Realized"   value={realized} />
        <MetricCard title="Sharpe"     value={sharpe} />
      </div>

      <div className="bg-gray-900 p-4 rounded-xl border border-gray-800">
        <EquityChart />
      </div>

      <div className="bg-gray-900 p-4 rounded-xl">
        {positions.length === 0 ? (
          <div className="text-gray-400 text-center">
            No active positions yet. Start trading.
          </div>
        ) : (
          positions.map((p) => (
            <div key={p.symbol} className="flex justify-between text-white">
              <span>{p.symbol}</span>
              <span>{p.quantity}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
