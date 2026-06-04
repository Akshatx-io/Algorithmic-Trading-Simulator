import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { Sparkles, Star, ShieldCheck, Loader2 } from "lucide-react";

import Card, { CardHeader, CardBody } from "../components/ui/Card";
import { getOptimization } from "../services/optimizerService";
import { STOCK_SYMBOLS } from "../utils/stockSymbols";

const DEFAULT = ["AAPL", "MSFT", "NVDA", "AMZN", "GOOGL"];
// Low-Sharpe (deep indigo) -> high-Sharpe (radiant green): viridis-like ramp.
const RAMP = ["#4338ca", "#2563eb", "#0891b2", "#0d9488", "#16a34a", "#4ade80"];
const N_BINS = RAMP.length;

const pct = (v) => `${Number(v || 0).toFixed(2)}%`;

function FrontierTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-line bg-ink-950/95 px-3 py-2 text-sm shadow-xl">
      <p className="tnum text-white">Return {pct(p.ret)}</p>
      <p className="tnum text-gray-300">Risk {pct(p.vol)}</p>
      <p className="tnum" style={{ color: "#4ade80" }}>Sharpe {Number(p.sharpe).toFixed(3)}</p>
    </div>
  );
}

function WeightBars({ weights, accent }) {
  const entries = Object.entries(weights || {}).sort((a, b) => b[1] - a[1]);
  return (
    <div className="space-y-2">
      {entries.map(([sym, w]) => (
        <div key={sym} className="flex items-center gap-3 text-sm">
          <span className="w-14 shrink-0 font-medium text-gray-300">{sym}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink-900">
            <div className="h-2 rounded-full" style={{ width: `${Math.max(w, 0)}%`, backgroundColor: accent }} />
          </div>
          <span className="w-14 shrink-0 text-right tnum text-gray-400">{w.toFixed(1)}%</span>
        </div>
      ))}
    </div>
  );
}

function PortfolioCard({ title, icon, accent, data }) {
  const Icon = icon;
  if (!data) return null;
  return (
    <Card className="card-pad">
      <div className="mb-4 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: `${accent}22`, color: accent }}>
          <Icon size={16} />
        </span>
        <h3 className="text-base font-semibold text-white">{title}</h3>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-line/70 bg-ink-900/60 p-3">
          <p className="text-xs text-gray-400">Return</p>
          <p className="tnum text-lg font-semibold" style={{ color: accent }}>{pct(data.return)}</p>
        </div>
        <div className="rounded-xl border border-line/70 bg-ink-900/60 p-3">
          <p className="text-xs text-gray-400">Risk</p>
          <p className="tnum text-lg font-semibold text-white">{pct(data.volatility)}</p>
        </div>
        <div className="rounded-xl border border-line/70 bg-ink-900/60 p-3">
          <p className="text-xs text-gray-400">Sharpe</p>
          <p className="tnum text-lg font-semibold text-white">{Number(data.sharpe).toFixed(3)}</p>
        </div>
      </div>
      <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-gray-500">Allocation</p>
      <WeightBars weights={data.weights} accent={accent} />
    </Card>
  );
}

export default function Optimizer() {
  const [selected, setSelected] = useState(DEFAULT);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [runKey, setRunKey] = useState(0);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      if (selected.length < 2) {
        setData({ status: "need_two_symbols" });
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const d = await getOptimization(selected, 6000);
        if (mounted) setData(d);
      } catch {
        if (mounted) setData({ status: "error" });
      } finally {
        if (mounted) setLoading(false);
      }
    };
    run();
    return () => {
      mounted = false;
    };
    // re-run only when the user clicks Optimize (runKey), not on every toggle
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runKey]);

  const frontier = useMemo(() => data?.frontier || [], [data]);

  // Bin the cloud by Sharpe into colored series (radiant ramp).
  const bins = useMemo(() => {
    if (!frontier.length) return [];
    const sh = frontier.map((p) => p.sharpe);
    const lo = Math.min(...sh);
    const hi = Math.max(...sh);
    const span = hi - lo || 1;
    const out = Array.from({ length: N_BINS }, () => []);
    frontier.forEach((p) => {
      let idx = Math.floor(((p.sharpe - lo) / span) * N_BINS);
      if (idx >= N_BINS) idx = N_BINS - 1;
      if (idx < 0) idx = 0;
      out[idx].push(p);
    });
    return out;
  }, [frontier]);

  const maxSharpePoint = data?.max_sharpe
    ? [{ vol: data.max_sharpe.volatility, ret: data.max_sharpe.return, sharpe: data.max_sharpe.sharpe }]
    : [];
  const minVolPoint = data?.min_vol
    ? [{ vol: data.min_vol.volatility, ret: data.min_vol.return, sharpe: data.min_vol.sharpe }]
    : [];

  const toggle = (sym) =>
    setSelected((cur) => (cur.includes(sym) ? cur.filter((s) => s !== sym) : [...cur, sym]));

  return (
    <div className="space-y-6">
      {/* CONTROLS */}
      <Card className="card-pad">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="mb-2 text-sm text-gray-400">Universe ({selected.length} selected)</p>
            <div className="flex flex-wrap gap-2">
              {STOCK_SYMBOLS.map((s) => {
                const on = selected.includes(s);
                return (
                  <button
                    key={s}
                    onClick={() => toggle(s)}
                    className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                      on
                        ? "border-brand-500/40 bg-brand-500/15 text-white"
                        : "border-line bg-ink-900 text-gray-400 hover:text-white"
                    }`}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>
          <button
            onClick={() => setRunKey((k) => k + 1)}
            disabled={loading || selected.length < 2}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-gradient px-5 py-2.5 text-sm font-semibold text-white shadow-glow transition hover:opacity-90 disabled:opacity-50"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {loading ? "Optimizing…" : "Optimize"}
          </button>
        </div>
      </Card>

      {/* EFFICIENT FRONTIER */}
      <Card>
        <CardHeader
          title="Efficient Frontier"
          subtitle={data?.n_portfolios ? `${data.n_portfolios.toLocaleString()} Monte-Carlo portfolios` : "Monte-Carlo simulation"}
          action={<Sparkles size={18} className="text-brand-400" />}
        />
        <CardBody>
          {loading ? (
            <div className="flex h-[420px] items-center justify-center text-gray-500">Running {Number(6000).toLocaleString()} simulations…</div>
          ) : data?.status !== "success" ? (
            <div className="flex h-[420px] items-center justify-center text-center text-gray-500">
              {data?.status === "need_two_symbols"
                ? "Select at least two symbols, then click Optimize."
                : data?.status === "insufficient_data"
                ? "Not enough overlapping history for these symbols."
                : "No data."}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={420}>
              <ScatterChart margin={{ top: 10, right: 16, bottom: 16, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.08)" />
                <XAxis
                  type="number"
                  dataKey="vol"
                  name="Risk"
                  unit="%"
                  domain={["auto", "auto"]}
                  tick={{ fill: "#94a3b8", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  label={{ value: "Volatility (Risk)", position: "insideBottom", offset: -8, fill: "#64748b", fontSize: 12 }}
                />
                <YAxis
                  type="number"
                  dataKey="ret"
                  name="Return"
                  unit="%"
                  domain={["auto", "auto"]}
                  tick={{ fill: "#94a3b8", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={52}
                  label={{ value: "Expected Return", angle: -90, position: "insideLeft", fill: "#64748b", fontSize: 12 }}
                />
                <ZAxis range={[10, 10]} />
                <Tooltip content={<FrontierTooltip />} cursor={{ strokeDasharray: "3 3", stroke: "#334155" }} />
                {bins.map((pts, i) => (
                  <Scatter
                    key={i}
                    data={pts}
                    fill={RAMP[i]}
                    fillOpacity={0.55}
                    isAnimationActive={false}
                  />
                ))}
                <Scatter data={minVolPoint} fill="#60a5fa" shape="star" isAnimationActive={false}>
                  <ZAxis range={[260, 260]} />
                </Scatter>
                <Scatter data={maxSharpePoint} fill="#f43f5e" shape="star" isAnimationActive={false}>
                  <ZAxis range={[320, 320]} />
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          )}

          {data?.status === "success" && (
            <div className="mt-4 flex flex-wrap gap-5 text-sm text-gray-400">
              <span className="flex items-center gap-2"><Star size={14} className="text-down" /> Max Sharpe</span>
              <span className="flex items-center gap-2"><Star size={14} className="text-accent-400" /> Min Volatility</span>
              <span className="flex items-center gap-2">
                <span className="inline-block h-3 w-12 rounded-sm" style={{ background: `linear-gradient(90deg, ${RAMP[0]}, ${RAMP[RAMP.length - 1]})` }} />
                low → high Sharpe
              </span>
            </div>
          )}
        </CardBody>
      </Card>

      {/* OPTIMAL PORTFOLIOS */}
      {data?.status === "success" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <PortfolioCard title="Max Sharpe Portfolio" icon={Star} accent="#f43f5e" data={data.max_sharpe} />
          <PortfolioCard title="Min Volatility Portfolio" icon={ShieldCheck} accent="#60a5fa" data={data.min_vol} />
        </div>
      )}
    </div>
  );
}
