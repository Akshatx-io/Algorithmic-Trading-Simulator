import usePerformance from "../hooks/usePerformance";
import EquityChart from "../components/charts/EquityChart";

const pct = (v) => `${(Number(v || 0) * 100).toFixed(2)}%`;
const num = (v, d = 2) => Number(v || 0).toFixed(d);

/**
 * Performance — analytics dashboard.
 * Formats the raw backend metrics into readable KPIs and shows the equity curve.
 */
const Performance = () => {
  const data = usePerformance();

  if (!data) {
    return (
      <div className="flex h-[300px] items-center justify-center text-gray-500">
        Loading performance…
      </div>
    );
  }

  const m = data.metrics || {};

  const primary = [
    {
      label: "Total Return",
      value: pct(m.total_return),
      tone: Number(m.total_return) >= 0 ? "pos" : "neg",
      hint: "Equity growth since inception",
    },
    {
      label: "Sharpe Ratio",
      value: num(m.sharpe_ratio),
      tone: Number(m.sharpe_ratio) >= 1 ? "pos" : "neutral",
      hint: "Risk-adjusted return (higher is better)",
    },
    {
      label: "Max Drawdown",
      value: pct(m.max_drawdown),
      tone: "neg",
      hint: "Largest peak-to-trough decline",
    },
    {
      label: "Win Rate",
      value: pct(m.win_rate),
      tone: Number(m.win_rate) >= 0.5 ? "pos" : "neutral",
      hint: "Share of profitable trades",
    },
  ];

  const secondary = [
    { label: "Volatility", value: pct(m.volatility) },
    { label: "Profit Factor", value: num(m.profit_factor) },
    { label: "Total Trades", value: num(m.total_trades, 0) },
    { label: "Avg Profit", value: `$${num(m.avg_profit)}` },
    { label: "Avg Loss", value: `$${num(m.avg_loss)}` },
  ];

  return (
    <div className="space-y-6">
      {/* PRIMARY KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {primary.map((k) => (
          <div
            key={k.label}
            className="rounded-xl border border-gray-800 bg-gray-900 p-5"
          >
            <p className="text-sm text-gray-400">{k.label}</p>
            <p
              className={`mt-1 text-2xl font-semibold ${
                k.tone === "pos"
                  ? "text-emerald-400"
                  : k.tone === "neg"
                  ? "text-red-400"
                  : "text-white"
              }`}
            >
              {k.value}
            </p>
            <p className="mt-2 text-xs text-gray-500">{k.hint}</p>
          </div>
        ))}
      </div>

      {/* EQUITY CURVE */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
        <EquityChart />
      </div>

      {/* SECONDARY STATS */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
        <h3 className="mb-4 text-lg font-semibold text-white">Trade Statistics</h3>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {secondary.map((s) => (
            <div key={s.label} className="rounded-lg bg-gray-800 p-4">
              <p className="text-xs text-gray-400">{s.label}</p>
              <p className="mt-1 text-lg font-medium text-white">{s.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Performance;
