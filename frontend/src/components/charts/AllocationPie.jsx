import { useMemo } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

/**
 * AllocationPie — donut chart of portfolio allocation by market value.
 *
 * Robustness notes:
 * - The chart lives inside an explicitly-sized box (h-[300px]); recharts 3 +
 *   React 19 will render nothing if the ResponsiveContainer parent has no
 *   resolved height, which was the previous failure mode.
 * - All numeric inputs are coerced defensively; entries with non-positive
 *   value are dropped so the pie geometry never breaks.
 */

const COLORS = [
  "#34d399", "#60a5fa", "#f472b6", "#facc15",
  "#a78bfa", "#fb923c", "#22d3ee", "#f87171",
];

const parseNumber = (v) => {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const n = Number(v.replace(/[^0-9.-]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
};

const fmtUsd = (n) =>
  `$${Number(n || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const AllocationPie = ({ positions, onSelect }) => {
  const data = useMemo(() => {
    return (Array.isArray(positions) ? positions : [])
      .map((pos) => {
        const quantity = parseNumber(pos.quantity);
        const price = parseNumber(pos.current_price ?? pos.avg_price);
        const value = parseNumber(pos.market_value) || quantity * price;
        return { name: pos.symbol, value: value > 0 ? value : 0, position: pos };
      })
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [positions]);

  const total = useMemo(() => data.reduce((s, d) => s + d.value, 0), [data]);

  if (data.length === 0) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-xl border border-gray-800 bg-gray-900 p-6 text-center text-gray-400">
        Allocation appears once positions have a market value.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
      <h3 className="mb-4 text-lg font-semibold text-white">Asset Allocation</h3>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:items-center">
        {/* Chart — explicitly sized box so ResponsiveContainer always measures. */}
        <div className="relative h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius="58%"
                outerRadius="85%"
                paddingAngle={2}
                minAngle={3}
                dataKey="value"
                nameKey="name"
                stroke="none"
                isAnimationActive
                animationDuration={500}
                onClick={(entry) =>
                  onSelect?.(entry?.position ?? entry?.payload?.position)
                }
              >
                {data.map((entry, index) => (
                  <Cell
                    key={entry.name}
                    fill={COLORS[index % COLORS.length]}
                    className="cursor-pointer outline-none"
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(value, name) => [fmtUsd(value), name]}
                contentStyle={{
                  backgroundColor: "#0b1120",
                  border: "1px solid #334155",
                  borderRadius: "8px",
                  color: "#e2e8f0",
                }}
              />
            </PieChart>
          </ResponsiveContainer>

          {/* Center total label */}
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xs text-gray-400">Total</span>
            <span className="text-lg font-semibold text-white">{fmtUsd(total)}</span>
          </div>
        </div>

        {/* Custom legend with values + share % */}
        <ul className="space-y-2">
          {data.map((entry, index) => {
            const pct = total > 0 ? (entry.value / total) * 100 : 0;
            return (
              <li
                key={entry.name}
                onClick={() => onSelect?.(entry.position)}
                className="flex cursor-pointer items-center justify-between rounded-lg px-2 py-1 hover:bg-gray-800"
              >
                <span className="flex items-center gap-2 text-sm text-gray-200">
                  <span
                    className="inline-block h-3 w-3 rounded-sm"
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  {entry.name}
                </span>
                <span className="text-sm text-gray-400">
                  {fmtUsd(entry.value)}{" "}
                  <span className="text-gray-500">({pct.toFixed(1)}%)</span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};

export default AllocationPie;
