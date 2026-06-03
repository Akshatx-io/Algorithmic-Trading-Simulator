import { useMemo } from "react";
import {
  Wallet,
  TrendingUp,
  Activity,
  Gauge,
  CircleDollarSign,
} from "lucide-react";

import EquityChart from "../components/charts/EquityChart";
import AllocationPie from "../components/charts/AllocationPie";
import LoadingSpinner from "../components/common/LoadingSpinner";
import StatCard from "../components/ui/StatCard";
import Card, { CardHeader } from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import usePortfolio from "../hooks/usePortfolio";
import usePerformance from "../hooks/usePerformance";
import { formatCurrency } from "../utils/formatCurrency";

const n = (v) => (typeof v === "number" && !Number.isNaN(v) ? v : 0);

export default function Dashboard() {
  const { portfolio, loading, error } = usePortfolio();
  const perf = usePerformance();

  const { positions, equity, pnl, unrealized, realized, pnlPct } = useMemo(() => {
    const p = portfolio || {};
    return {
      positions: Array.isArray(p.positions) ? p.positions : [],
      equity: n(p.total_equity),
      pnl: n(p.total_pnl),
      unrealized: n(p.unrealized_pnl),
      realized: n(p.realized_pnl),
      pnlPct: n(p.pnl_percentage),
    };
  }, [portfolio]);

  const sharpe = n(perf?.metrics?.sharpe_ratio);

  if (loading && !portfolio?.positions?.length) return <LoadingSpinner />;
  if (error) return <div className="text-down">{error}</div>;

  return (
    <div className="space-y-6">
      {/* KPI ROW */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Equity" value={formatCurrency(equity)} icon={Wallet} />
        <StatCard
          label="Total P&L"
          value={formatCurrency(pnl)}
          tone={pnl >= 0 ? "up" : "down"}
          delta={pnlPct}
          deltaSuffix="%"
          icon={TrendingUp}
        />
        <StatCard
          label="Unrealized"
          value={formatCurrency(unrealized)}
          tone={unrealized >= 0 ? "up" : "down"}
          icon={Activity}
        />
        <StatCard
          label="Realized"
          value={formatCurrency(realized)}
          tone={realized >= 0 ? "up" : "down"}
          icon={CircleDollarSign}
        />
        <StatCard label="Sharpe" value={sharpe.toFixed(2)} icon={Gauge} accent="accent" />
      </div>

      {/* EQUITY CURVE */}
      <Card className="card-pad">
        <EquityChart />
      </Card>

      {/* POSITIONS + ALLOCATION */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Open Positions" subtitle={`${positions.length} holding(s)`} />
          <div className="px-2 pb-2 pt-3">
            {positions.length === 0 ? (
              <div className="px-3 py-10 text-center text-sm text-gray-500">
                No open positions yet. Head to{" "}
                <span className="text-brand-400">Trade</span> to place your first order.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                    <th className="px-3 py-2 font-medium">Symbol</th>
                    <th className="px-3 py-2 text-right font-medium">Qty</th>
                    <th className="px-3 py-2 text-right font-medium">Price</th>
                    <th className="px-3 py-2 text-right font-medium">Value</th>
                    <th className="px-3 py-2 text-right font-medium">P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map((p) => {
                    const upnl = n(p.unrealized_pnl ?? p.pnl);
                    return (
                      <tr
                        key={p.symbol}
                        className="border-t border-line/60 transition hover:bg-ink-700/40"
                      >
                        <td className="px-3 py-2.5 font-semibold text-white">{p.symbol}</td>
                        <td className="px-3 py-2.5 text-right tnum text-gray-300">
                          {n(p.quantity)}
                        </td>
                        <td className="px-3 py-2.5 text-right tnum text-gray-300">
                          {formatCurrency(n(p.current_price))}
                        </td>
                        <td className="px-3 py-2.5 text-right tnum text-gray-300">
                          {formatCurrency(n(p.market_value))}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <Badge variant={upnl >= 0 ? "up" : "down"}>
                            {upnl >= 0 ? "+" : ""}
                            {formatCurrency(upnl)}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </Card>

        <div>
          <AllocationPie positions={positions} />
        </div>
      </div>
    </div>
  );
}
