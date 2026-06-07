import { useEffect, useMemo, useRef, useState } from "react";
import {
  ResponsiveContainer, ComposedChart, AreaChart, Area, Line,
  BarChart, Bar, Cell, ScatterChart, Scatter,
  XAxis, YAxis, ZAxis, Tooltip, CartesianGrid, ReferenceLine,
} from "recharts";
import { BrainCircuit, TrendingUp, TrendingDown, Loader2, Cpu } from "lucide-react";

import Card, { CardHeader, CardBody } from "../components/ui/Card";
import InfoButton from "../components/ui/InfoButton";
import { getPrediction } from "../services/predictService";
import { GLOSSARY } from "../utils/glossary";

const SYMBOLS = ["AAPL", "MSFT", "NVDA", "AMZN", "GOOGL", "META", "TSLA", "NFLX", "AMD", "INTC", "UBER"];
const DEFAULTS = { symbol: "AAPL", years: 4, n_estimators: 80, max_depth: 6, cost_bps: 2, mc_sims: 400 };
const inputCls = "w-full rounded-lg border border-line bg-ink-900 px-3 py-2 text-sm text-white outline-none transition focus:border-brand-500/60 focus:ring-2 focus:ring-brand-500/20";
const tip = { contentStyle: { backgroundColor: "#0b1120", border: "1px solid #334155", borderRadius: 8, color: "#e2e8f0" } };
const growth = (v) => `${((v - 1) * 100).toFixed(0)}%`;

function Field({ label, children }) {
  return <div><label className="mb-1 block text-xs text-gray-400">{label}</label>{children}</div>;
}
function Num({ value, onChange, step = "1", min, max }) {
  return <input type="number" value={value} step={step} min={min} max={max} onChange={(e) => onChange(e.target.value)} className={inputCls} />;
}
function Metric({ label, value, info, tone = "gray" }) {
  const tint = { gray: "text-white", up: "text-up", down: "text-down", brand: "text-brand-300" }[tone];
  return (
    <div className="rounded-xl border border-line/70 bg-ink-900/60 p-3">
      <div className="flex items-center gap-1">
        <p className="text-[10px] uppercase tracking-wide text-gray-500">{label}</p>
        {info && <InfoButton entry={info} size={11} accent="#60a5fa" />}
      </div>
      <p className={`tnum mt-1 text-lg font-semibold ${tint}`}>{value}</p>
    </div>
  );
}

export default function Predictor() {
  const [form, setForm] = useState(DEFAULTS);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const timer = useRef(0);
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setLoading(true);
      try { setData(await getPrediction(form)); }
      catch { setData({ status: "error" }); }
      finally { setLoading(false); }
    }, 400);
    return () => clearTimeout(timer.current);
  }, [form]);

  const ok = data?.status === "success";
  const m = ok ? data.metrics : {};
  const s = ok ? data.strategy : {};
  const nd = ok ? data.next_day : {};
  const up = nd.direction === "UP";

  const mcRows = useMemo(() => {
    if (!ok) return [];
    const fan = data.mc_fan.slice(0, 24);
    return data.mc_bands.map((b, k) => {
      const row = { i: b.i, p5: b.p5, p50: b.p50, p95: b.p95, band: [b.p5, b.p95] };
      fan.forEach((p, j) => { row[`f${j}`] = p[k]; });
      return row;
    });
  }, [data, ok]);
  const fanKeys = useMemo(() => (ok ? data.mc_fan.slice(0, 24).map((_, j) => `f${j}`) : []), [data, ok]);

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
      {/* LEFT: controls + forecast + metrics */}
      <div className="space-y-6 xl:col-span-1">
        <Card className="card-pad">
          <div className="mb-4 flex items-center gap-1.5">
            <BrainCircuit size={16} className="text-brand-400" />
            <h3 className="text-base font-semibold text-white">Model Setup</h3>
            <InfoButton entry={GLOSSARY.predictor} accent="#34d399" size={14} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Symbol">
              <select value={form.symbol} onChange={(e) => set("symbol")(e.target.value)} className={inputCls}>
                {SYMBOLS.map((x) => <option key={x} value={x}>{x}</option>)}
              </select>
            </Field>
            <Field label="History (years)"><Num value={form.years} onChange={set("years")} min="2" max="8" /></Field>
            <Field label="Trees"><Num value={form.n_estimators} onChange={set("n_estimators")} step="10" min="20" max="200" /></Field>
            <Field label="Max Depth"><Num value={form.max_depth} onChange={set("max_depth")} min="2" max="12" /></Field>
            <Field label="Cost (bps)"><Num value={form.cost_bps} onChange={set("cost_bps")} min="0" /></Field>
            <Field label="MC Sims"><Num value={form.mc_sims} onChange={set("mc_sims")} step="50" min="50" max="1000" /></Field>
          </div>
          {ok && <p className="mt-3 flex items-center gap-1.5 text-xs text-gray-500"><Cpu size={12} /> {data.model} · {m.n_train} train / {m.n_test} test days</p>}
        </Card>

        {ok && (
          <Card className="card-pad">
            <div className="mb-3 flex items-center gap-1.5">
              <h3 className="text-base font-semibold text-white">Next-Day Forecast</h3>
              <InfoButton entry={GLOSSARY.predictor} size={13} />
            </div>
            <div className={`rounded-2xl border p-4 ${up ? "border-up/30 bg-up/5" : "border-down/30 bg-down/5"}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-400">{data.symbol} expected move</p>
                  <p className={`tnum text-3xl font-bold ${up ? "text-up" : "text-down"}`}>
                    {nd.pred_return >= 0 ? "+" : ""}{nd.pred_return}%
                  </p>
                </div>
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${up ? "bg-up/15 text-up" : "bg-down/15 text-down"}`}>
                  {up ? <TrendingUp size={24} /> : <TrendingDown size={24} />}
                </div>
              </div>
              <div className="mt-3">
                <div className="mb-1 flex justify-between text-xs text-gray-400">
                  <span>Model confidence (tree agreement)</span><span className="tnum">{nd.confidence}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-900">
                  <div className={`h-full rounded-full ${up ? "bg-up" : "bg-down"}`} style={{ width: `${nd.confidence}%` }} />
                </div>
              </div>
            </div>
          </Card>
        )}

        {ok && (
          <Card className="card-pad">
            <h3 className="mb-3 text-base font-semibold text-white">Out-of-Sample Metrics</h3>
            <div className="grid grid-cols-2 gap-3">
              <Metric label="Directional Acc" value={`${m.directional_acc}%`} info={GLOSSARY.directionalAcc} tone={m.directional_acc >= 52 ? "up" : "gray"} />
              <Metric label="Info Coeff (IC)" value={m.ic} info={GLOSSARY.infoCoeff} tone={m.ic > 0 ? "up" : "down"} />
              <Metric label="R²" value={m.r2} info={GLOSSARY.rSquared} />
              <Metric label="RMSE" value={`${m.rmse}%`} />
              <Metric label="Strategy Ret" value={`${s.total_return}%`} info={GLOSSARY.totalReturn} tone={s.total_return >= 0 ? "up" : "down"} />
              <Metric label="Sharpe" value={s.sharpe} info={GLOSSARY.sharpe} tone={s.sharpe >= 1 ? "up" : "gray"} />
              <Metric label="Alpha vs B&H" value={`${s.alpha >= 0 ? "+" : ""}${s.alpha}%`} info={GLOSSARY.alpha} tone={s.alpha >= 0 ? "up" : "down"} />
              <Metric label="Max DD" value={`${s.max_drawdown}%`} info={GLOSSARY.maxDrawdown} tone="down" />
            </div>
            <p className="mt-3 text-xs text-gray-500">Buy &amp; hold: <span className="tnum text-gray-300">{data.benchmark.total_return}%</span> · Sharpe <span className="tnum text-gray-300">{data.benchmark.sharpe}</span></p>
          </Card>
        )}
      </div>

      {/* RIGHT: charts */}
      <div className="space-y-6 xl:col-span-2">
        <Card className="card-pad">
          <div className="mb-1 flex items-center gap-1.5">
            <h3 className="text-base font-semibold text-white">Monte Carlo Equity Paths</h3>
            {loading && <Loader2 size={14} className="animate-spin text-brand-400" />}
            <InfoButton entry={GLOSSARY.monteCarloResample} accent="#34d399" size={15} />
          </div>
          {ok && (
            <div className="mb-2 flex flex-wrap items-center gap-4 text-xs text-gray-400">
              <span>Prob. profit: <span className="tnum font-semibold text-up">{data.mc.prob_profit}%</span></span>
              <span>Median: <span className="tnum text-gray-200">{data.mc.median_return}%</span></span>
              <span>5–95%: <span className="tnum text-gray-200">{data.mc.p5_return}% … {data.mc.p95_return}%</span></span>
              <span className="text-gray-500">({data.mc.sims} resamples)</span>
            </div>
          )}
          {!ok ? (
            <div className="flex h-[300px] items-center justify-center text-sm text-gray-500">{loading ? "Training model & resampling…" : "Adjust setup."}</div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={mcRows} margin={{ top: 6, right: 14, left: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.08)" vertical={false} />
                <XAxis dataKey="i" tick={{ fill: "#94a3b8", fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}d`} minTickGap={50} />
                <YAxis tickFormatter={growth} tick={{ fill: "#94a3b8", fontSize: 11 }} tickLine={false} axisLine={false} width={48} domain={["auto", "auto"]} />
                <Tooltip {...tip} formatter={(v, n) => [growth(Array.isArray(v) ? v[1] : v), n === "p50" ? "Median" : n === "band" ? "5–95%" : n]} labelFormatter={(l) => `Day ${l}`} />
                <Area dataKey="band" stroke="none" fill="#34d399" fillOpacity={0.12} isAnimationActive={false} />
                {fanKeys.map((k) => (
                  <Line key={k} dataKey={k} stroke="#60a5fa" strokeWidth={0.7} strokeOpacity={0.18} dot={false} isAnimationActive={false} tooltipType="none" legendType="none" />
                ))}
                <Line dataKey="p50" stroke="#34d399" strokeWidth={2.6} dot={false} isAnimationActive={false} />
                <ReferenceLine y={1} stroke="#64748b" strokeDasharray="4 4" />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card className="card-pad">
          <CardHeader title="Strategy vs Buy & Hold" subtitle="Realized out-of-sample equity" />
          <CardBody>
            {ok ? (
              <ResponsiveContainer width="100%" height={200}>
                <ComposedChart data={data.equity} margin={{ top: 6, right: 14, left: 4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.08)" vertical={false} />
                  <XAxis dataKey="i" tick={{ fill: "#94a3b8", fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}d`} minTickGap={50} />
                  <YAxis tickFormatter={growth} tick={{ fill: "#94a3b8", fontSize: 11 }} tickLine={false} axisLine={false} width={48} domain={["auto", "auto"]} />
                  <Tooltip {...tip} formatter={(v, n) => [growth(v), n === "strategy" ? "Strategy" : "Buy & Hold"]} labelFormatter={(l) => `Day ${l}`} />
                  <Line dataKey="benchmark" stroke="#64748b" strokeWidth={1.8} dot={false} isAnimationActive={false} />
                  <Line dataKey="strategy" stroke="#34d399" strokeWidth={2.4} dot={false} isAnimationActive={false} />
                  <ReferenceLine y={1} stroke="#475569" strokeDasharray="4 4" />
                </ComposedChart>
              </ResponsiveContainer>
            ) : <div className="flex h-[200px] items-center justify-center text-gray-500">—</div>}
          </CardBody>
        </Card>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card className="card-pad">
            <CardHeader title="Feature Importance" action={<InfoButton entry={GLOSSARY.featureImportance} size={14} accent="#60a5fa" />} />
            <CardBody>
              {ok ? (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={data.importances} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.06)" horizontal={false} />
                    <XAxis type="number" tickFormatter={(v) => `${v}%`} tick={{ fill: "#94a3b8", fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis type="category" dataKey="feature" tick={{ fill: "#94a3b8", fontSize: 10 }} tickLine={false} axisLine={false} width={56} />
                    <Tooltip {...tip} formatter={(v) => [`${v}%`, "Importance"]} cursor={{ fill: "rgba(148,163,184,0.06)" }} />
                    <Bar dataKey="importance" radius={[0, 3, 3, 0]} isAnimationActive={false}>
                      {data.importances.map((d, i) => <Cell key={d.feature} fill={i === 0 ? "#34d399" : "#3b82f6"} fillOpacity={1 - i * 0.05} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : <div className="flex h-[260px] items-center justify-center text-gray-500">—</div>}
            </CardBody>
          </Card>

          <Card className="card-pad">
            <CardHeader title="Actual vs Predicted" subtitle="Next-day return (%), test set" />
            <CardBody>
              {ok ? (
                <ResponsiveContainer width="100%" height={260}>
                  <ScatterChart margin={{ top: 6, right: 16, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.08)" />
                    <XAxis type="number" dataKey="actual" name="Actual" unit="%" tick={{ fill: "#94a3b8", fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis type="number" dataKey="pred" name="Predicted" unit="%" tick={{ fill: "#94a3b8", fontSize: 10 }} tickLine={false} axisLine={false} width={40} />
                    <ZAxis range={[24, 24]} />
                    <Tooltip {...tip} cursor={{ strokeDasharray: "3 3" }} formatter={(v) => `${Number(v).toFixed(2)}%`} />
                    <ReferenceLine x={0} stroke="#475569" /><ReferenceLine y={0} stroke="#475569" />
                    <Scatter data={data.scatter} fill="#60a5fa" fillOpacity={0.55} isAnimationActive={false} />
                  </ScatterChart>
                </ResponsiveContainer>
              ) : <div className="flex h-[260px] items-center justify-center text-gray-500">—</div>}
            </CardBody>
          </Card>
        </div>

        <Card className="card-pad">
          <CardHeader title="Monte Carlo Terminal Return Distribution" subtitle="green = profitable resamples" action={<InfoButton entry={GLOSSARY.monteCarloResample} size={14} accent="#60a5fa" />} />
          <CardBody>
            {ok ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data.terminal_hist} margin={{ top: 6, right: 14, left: 4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.08)" vertical={false} />
                  <XAxis dataKey="ret" tickFormatter={(v) => `${v}%`} tick={{ fill: "#94a3b8", fontSize: 10 }} tickLine={false} axisLine={false} minTickGap={24} />
                  <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} tickLine={false} axisLine={false} width={36} />
                  <Tooltip {...tip} formatter={(v) => [v, "Resamples"]} labelFormatter={(l) => `${l}% return`} />
                  <ReferenceLine x={0} stroke="#f43f5e" strokeDasharray="4 4" />
                  <Bar dataKey="count" radius={[2, 2, 0, 0]} isAnimationActive={false}>
                    {data.terminal_hist.map((d) => <Cell key={d.ret} fill={d.ret >= 0 ? "#34d399" : "#f43f5e"} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="flex h-[200px] items-center justify-center text-gray-500">—</div>}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
