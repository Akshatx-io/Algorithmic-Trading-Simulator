import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceArea,
  CartesianGrid,
} from "recharts";
import { Activity, TrendingUp, TrendingDown, Minus, Layers } from "lucide-react";

import Card, { CardHeader, CardBody } from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import { getRegime } from "../services/regimeService";
import { STOCK_SYMBOLS } from "../utils/stockSymbols";

const INTERVALS = ["1d", "15m", "5m"];
const RC = { Bull: "#22c55e", Bear: "#ef4444", Sideways: "#f59e0b" };
const RICON = { Bull: TrendingUp, Bear: TrendingDown, Sideways: Minus };
const BADGE = { Bull: "up", Bear: "down", Sideways: "hold" };

const fmtDate = (epoch) => {
  const d = new Date(Number(epoch) * 1000);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};
const fmtUsd = (n) => `$${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Group contiguous same-regime bars into colored bands for the chart.
function buildSegments(points) {
  const segs = [];
  if (!points.length) return segs;
  let start = points[0];
  let prev = points[0];
  for (let i = 1; i < points.length; i++) {
    const p = points[i];
    if (p.regime !== prev.regime) {
      segs.push({ x1: start.time, x2: prev.time, regime: prev.regime });
      start = p;
    }
    prev = p;
  }
  segs.push({ x1: start.time, x2: prev.time, regime: prev.regime });
  return segs;
}

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-line bg-ink-950/95 px-3 py-2 text-sm shadow-xl">
      <p className="text-xs text-gray-400">{fmtDate(p.time)}</p>
      <p className="tnum text-white">{fmtUsd(p.close)}</p>
      <p className="text-xs" style={{ color: RC[p.regime] }}>{p.regime}</p>
    </div>
  );
}

export default function MarketRegime() {
  const [symbol, setSymbol] = useState("AAPL");
  const [interval, setInterval] = useState("1d");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      setLoading(true);
      try {
        const d = await getRegime(symbol, interval);
        if (mounted) setData(d);
      } catch {
        if (mounted) setData({ status: "error", points: [], summary: {} });
      } finally {
        if (mounted) setLoading(false);
      }
    };
    run();
    return () => {
      mounted = false;
    };
  }, [symbol, interval]);

  const points = useMemo(() => data?.points || [], [data]);
  const summary = data?.summary || {};
  const segments = useMemo(() => buildSegments(points), [points]);

  const current = summary.current_regime || "—";
  const CurIcon = RICON[current] || Activity;
  const dist = summary.distribution || {};
  const vol = summary.regime_volatility || {};

  return (
    <div className="space-y-6">
      {/* CONTROLS */}
      <Card className="card-pad">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-gray-400">Symbol</span>
            <select
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              className="rounded-lg border border-line bg-ink-900 px-3 py-1.5 text-sm text-white outline-none focus:border-brand-500/60"
            >
              {STOCK_SYMBOLS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-1 rounded-xl bg-ink-900 p-1">
            {INTERVALS.map((iv) => (
              <button
                key={iv}
                onClick={() => setInterval(iv)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  interval === iv ? "bg-ink-700 text-white ring-1 ring-line" : "text-gray-400 hover:text-white"
                }`}
              >
                {iv}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* HERO + DISTRIBUTION */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="card-pad">
          <p className="text-sm text-gray-400">Current Regime</p>
          <div className="mt-2 flex items-center gap-3">
            <span
              className="flex h-12 w-12 items-center justify-center rounded-xl"
              style={{ backgroundColor: `${RC[current] || "#64748b"}22`, color: RC[current] || "#94a3b8" }}
            >
              <CurIcon size={22} />
            </span>
            <div>
              <p className="text-2xl font-bold" style={{ color: RC[current] || "#fff" }}>{current}</p>
              <p className="text-xs text-gray-500">
                {summary.current_run ? `${summary.current_run} bars in regime` : "—"}
              </p>
            </div>
          </div>
          <p className="mt-4 text-sm text-gray-400">
            Last close <span className="tnum text-white">{fmtUsd(summary.last_close)}</span>
          </p>
        </Card>

        <Card className="card-pad lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm text-gray-400">Regime Distribution</p>
            <span className="text-xs text-gray-500">{summary.n_bars || 0} bars analyzed</span>
          </div>
          {/* stacked bar */}
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-ink-900">
            {["Bull", "Sideways", "Bear"].map((r) => (
              <div key={r} style={{ width: `${dist[r] || 0}%`, backgroundColor: RC[r] }} />
            ))}
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {["Bull", "Sideways", "Bear"].map((r) => (
              <div key={r} className="rounded-xl border border-line/70 bg-ink-900/60 p-3">
                <div className="flex items-center gap-2 text-sm">
                  <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: RC[r] }} />
                  <span className="text-gray-300">{r}</span>
                </div>
                <p className="mt-1 text-lg font-semibold tnum text-white">{(dist[r] || 0).toFixed(1)}%</p>
                <p className="text-xs text-gray-500">vol {(vol[r] || 0).toFixed(1)}%</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* PRICE WITH REGIME BANDS */}
      <Card>
        <CardHeader title={`${symbol} Price with Market Regimes`} subtitle="KMeans regime classification" action={<Layers size={18} className="text-accent-400" />} />
        <CardBody>
          {loading ? (
            <div className="flex h-[360px] items-center justify-center text-gray-500">Analyzing regimes…</div>
          ) : points.length === 0 ? (
            <div className="flex h-[360px] items-center justify-center text-gray-500">
              {data?.status === "insufficient_data" ? "Not enough history to classify regimes." : "No data."}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={360}>
              <LineChart data={points} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.10)" vertical={false} />
                {segments.map((s, i) => (
                  <ReferenceArea
                    key={`${s.x1}-${i}`}
                    x1={s.x1}
                    x2={s.x2}
                    fill={RC[s.regime]}
                    fillOpacity={0.14}
                    stroke="none"
                    ifOverflow="extendDomain"
                  />
                ))}
                <XAxis
                  dataKey="time"
                  type="number"
                  domain={["dataMin", "dataMax"]}
                  tickFormatter={fmtDate}
                  tick={{ fill: "#94a3b8", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={48}
                />
                <YAxis
                  tickFormatter={(v) => `$${Math.round(v)}`}
                  tick={{ fill: "#94a3b8", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={56}
                  domain={["auto", "auto"]}
                />
                <Tooltip content={<ChartTooltip />} />
                <Line type="monotone" dataKey="close" stroke="#e2e8f0" strokeWidth={1.8} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          )}

          {/* legend */}
          <div className="mt-4 flex flex-wrap gap-4">
            {["Bull", "Sideways", "Bear"].map((r) => (
              <div key={r} className="flex items-center gap-2 text-sm text-gray-400">
                <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: RC[r] }} />
                {r}
              </div>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
