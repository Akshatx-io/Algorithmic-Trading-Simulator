import { useEffect, useMemo, useRef, useState } from "react";
import { PieChart, Pie, Cell, Tooltip } from "recharts";

/**
 * AllocationPie - donut chart of portfolio allocation by market value.
 *
 * Robustness:
 * - We measure our own container width with a ResizeObserver and render a
 *   fixed-size <PieChart> only once width > 0. recharts' ResponsiveContainer
 *   intermittently measures 0 on first mount (the "empty on first visit /
 *   partial on second visit" bug); self-measuring removes that race.
 * - Animation is disabled so the ring can never be caught mid-draw.
 * - All numeric inputs are coerced; non-positive values are dropped.
 */

const COLORS = [
  "#34d399", "#60a5fa", "#f472b6", "#facc15",
  "#a78bfa", "#fb923c", "#22d3ee", "#f87171",
];

const CHART_HEIGHT = 240;

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
  const wrapRef = useRef(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => setWidth(Math.floor(el.clientWidth));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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

  const chartW = Math.min(width || 0, CHART_HEIGHT);
  const outer = Math.max(40, Math.min(chartW, CHART_HEIGHT) / 2 - 6);
  const inner = Math.max(24, outer * 0.62);

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
      <h3 className="mb-4 text-lg font-semibold text-white">Asset Allocation</h3>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:items-center">
        <div
          ref={wrapRef}
          className="relative flex w-full items-center justify-center"
          style={{ height: CHART_HEIGHT }}
        >
          {chartW > 0 && (
            <PieChart width={chartW} height={CHART_HEIGHT}>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={inner}
                outerRadius={outer}
                paddingAngle={2}
                minAngle={4}
                dataKey="value"
                nameKey="name"
                stroke="none"
                isAnimationActive={false}
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
          )}

          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xs text-gray-400">Total</span>
            <span className="text-lg font-semibold text-white">{fmtUsd(total)}</span>
          </div>
        </div>

        <ul className="space-y-2">
          {data.map((entry, index) => {
            const share = total > 0 ? (entry.value / total) * 100 : 0;
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
                  <span className="text-gray-500">({share.toFixed(1)}%)</span>
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
