import { useEffect, useMemo, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getPerformance } from "../../services/performanceService";

/**
 * EquityChart — smooth gradient area chart of the account equity curve.
 *
 * Data source: GET /performance -> { equityCurve: [{ time: epochSec, equity }] }
 * (the service normalizes the backend's `equity_curve` to `equityCurve`).
 */

const POLL_MS = 5000;

const formatUsd = (n) =>
  `$${Number(n || 0).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;

const formatTime = (epochSec) => {
  const d = new Date(Number(epochSec) * 1000);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
};

function EquityTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-lg border border-gray-700 bg-gray-950/95 px-3 py-2 shadow-xl">
      <p className="text-xs text-gray-400">{formatTime(point.time)}</p>
      <p className="text-sm font-semibold text-emerald-400">
        {`$${Number(point.equity || 0).toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`}
      </p>
    </div>
  );
}

export default function EquityChart() {
  const [data, setData] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    let mounted = true;

    const fetchData = async () => {
      try {
        const { equityCurve } = await getPerformance();
        if (!mounted) return;
        setData(Array.isArray(equityCurve) ? equityCurve : []);
      } catch (err) {
        if (mounted) console.error("[EquityChart] fetch failed:", err);
      } finally {
        if (mounted) setLoaded(true);
      }
    };

    fetchData();
    timerRef.current = setInterval(fetchData, POLL_MS);
    return () => {
      mounted = false;
      clearInterval(timerRef.current);
    };
  }, []);

  const { series, latest, change, changePct, up } = useMemo(() => {
    const s = (data || [])
      .map((d) => ({ time: Number(d.time), equity: Number(d.equity) }))
      .filter((d) => Number.isFinite(d.time) && Number.isFinite(d.equity));
    const first = s[0]?.equity ?? 0;
    const last = s[s.length - 1]?.equity ?? 0;
    const diff = last - first;
    return {
      series: s,
      latest: last,
      change: diff,
      changePct: first > 0 ? (diff / first) * 100 : 0,
      up: diff >= 0,
    };
  }, [data]);

  const stroke = up ? "#22c55e" : "#ef4444";
  const gradientId = "equityGradient";

  return (
    <div className="w-full">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <p className="text-sm text-gray-400">Account Equity</p>
          <p className="text-2xl font-semibold text-white">
            {`$${Number(latest).toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`}
          </p>
        </div>
        {series.length > 1 && (
          <div className={`text-right text-sm ${up ? "text-emerald-400" : "text-red-400"}`}>
            <span className="font-medium">
              {up ? "+" : ""}
              {`$${Math.abs(change).toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}`}
            </span>
            <span className="ml-2">
              ({up ? "+" : ""}
              {changePct.toFixed(2)}%)
            </span>
          </div>
        )}
      </div>

      {series.length === 0 ? (
        <div className="flex h-[300px] items-center justify-center rounded-lg border border-dashed border-gray-800 text-gray-500">
          {loaded
            ? "No equity history yet — place a trade to start your curve."
            : "Loading equity curve…"}
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={series} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={stroke} stopOpacity={0.45} />
                <stop offset="100%" stopColor={stroke} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" vertical={false} />
            <XAxis
              dataKey="time"
              tickFormatter={formatTime}
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              minTickGap={40}
            />
            <YAxis
              tickFormatter={formatUsd}
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={64}
              domain={["auto", "auto"]}
            />
            <Tooltip content={<EquityTooltip />} />
            <Area
              type="monotone"
              dataKey="equity"
              stroke={stroke}
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              isAnimationActive
              animationDuration={500}
              dot={false}
              activeDot={{ r: 4, fill: stroke, stroke: "#0b1120", strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
