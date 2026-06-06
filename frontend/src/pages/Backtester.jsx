import { useEffect, useMemo, useRef, useState } from "react";
import {
  ResponsiveContainer, ComposedChart, AreaChart, Area, Line,
  XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import { FlaskConical, Loader2, TrendingUp, TrendingDown } from "lucide-react";

import Card, { CardHeader, CardBody } from "../components/ui/Card";
import InfoButton from "../components/ui/InfoButton";
import { getBacktest } from "../services/backtestService";
import { GLOSSARY } from "../utils/glossary";

const SYMBOLS = ["AAPL", "MSFT", "NVDA", "AMZN", "GOOGL", "META", "TSLA", "NFLX", "AMD", "INTC", "UBER"];
const STRATEGIES = [
  { v: "sma", label: "SMA Crossover" },
  { v: "ema", label: "EMA Crossover" },
  { v: "rsi", label: "RSI Reversion" },
  { v: "momentum", label: "Momentum" },
  { v: "bollinger", label: "Bollinger Reversion" },
];
const DEFAULTS = { symbol: "AAPL", strategy: "sma", fast: 20, slow: 50, rsi_period: 14, rsi_buy: 30, rsi_sell: 55, cost_bps: 5, years: 3, initial: 100000 };

const money = (n) => `$${Math.round(n).toLocaleString("en-US")}`;
const kfmt = (v) => `$${(v / 1000).toFixed(0)}k`;
const tip = { contentStyle: { backgroundColor: "#0b1120", border: "1px solid #334155", borderRadius: 8, color: "#e2e8f0" } };

function Field({ label, children }) {
  return (
    <div>
      <label className="mb-1 block text-xs text-gray-400">{label}</label>
      {children}
    </div>
  );
}
const inputCls = "w-full rounded-lg border border-line bg-ink-900 px-3 py-2 text-sm text-white outline-none transition focus:border-brand-500/60 focus:ring-2 focus:ring-brand-500/20";

function Num({ value, onChange, step = "1", min }) {
  return <input type="number" value={value} step={step} min={min} onChange={(e) => onChange(e.target.value)} className={inputCls} />;
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

export default function Backtester() {
  const [form, setForm] = useState(DEFAULTS);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const timer = useRef(0);
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        setData(await getBacktest(form));
      } catch {
        setData({ status: "error" });
      } finally {
        setLoading(false);
      }
    }, 260);
    return () => clearTimeout(timer.current);
  }, [form]);

  const ok = data?.status === "success";
  const m = ok ? data.metrics : {};
  const b = ok ? data.benchmark : {};

  // map trade signals onto the (downsampled) series for chart markers
  const priceRows = useMemo(() => {
    if (!ok) return [];
    const rows = data.series.map((r) => ({ ...r }));
    const times = rows.map((r) => new Date(r.date).getTime());
    for (const sg of data.signals) {
      const t = new Date(sg.date).getTime();
      let best = 0, bd = Infinity;
      for (let i = 0; i < times.length; i++) {
        const d = Math.abs(times[i] - t);
        if (d < bd) { bd = d; best = i; }
      }
      rows[best][sg.type] = sg.price;
    }
    return rows;
  }, [data, ok]);

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
      {/* LEFT: controls + metrics */}
      <div className="space-y-6 xl:col-span-1">
        <Card className="card-pad">
          <div className="mb-4 flex items-center gap-1.5">
            <FlaskConical size={16} className="text-brand-400" />
            <h3 className="text-base font-semibold text-white">Backtest Setup</h3>
            <InfoButton entry={GLOSSARY.backtest} accent="#34d399" size={14} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Symbol">
              <select value={form.symbol} onChange={(e) => set("symbol")(e.target.value)} className={inputCls}>
                {SYMBOLS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Strategy">
              <select value={form.strategy} onChange={(e) => set("strategy")(e.target.value)} className={inputCls}>
                {STRATEGIES.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
              </select>
            </Field>

            {form.strategy === "rsi" ? (
              <>
                <Field label="RSI Period"><Num value={form.rsi_period} onChange={set("rsi_period")} min="2" /></Field>
                <Field label="Buy below"><Num value={form.rsi_buy} onChange={set("rsi_buy")} min="1" /></Field>
                <Field label="Sell above"><Num value={form.rsi_sell} onChange={set("rsi_sell")} min="1" /></Field>
              </>
            ) : (
              <>
                <Field label={form.strategy === "bollinger" || form.strategy === "momentum" ? "Window" : "Fast MA"}>
                  <Num value={form.fast} onChange={set("fast")} min="2" />
                </Field>
                <Field label={form.strategy === "bollinger" || form.strategy === "momentum" ? "Lookback" : "Slow MA"}>
                  <Num value={form.slow} onChange={set("slow")} min="3" />
                </Field>
              </>
            )}

            <Field label="Cost (bps)"><Num value={form.cost_bps} onChange={set("cost_bps")} step="1" min="0" /></Field>
            <Field label="Years"><Num value={form.years} onChange={set("years")} step="1" min="1" /></Field>
            <Field label="Capital"><Num value={form.initial} onChange={set("initial")} step="1000" min="1000" /></Field>
          </div>
        </Card>

        {ok && (
          <Card className="card-pad">
            <h3 className="mb-3 text-base font-semibold text-white">Performance</h3>
            <div className="grid grid-cols-2 gap-3">
              <Metric label="Total Return" value={`${m.total_return}%`} info={GLOSSARY.totalReturn} tone={m.total_return >= 0 ? "up" : "down"} />
              <Metric label="Alpha vs B&H" value={`${m.alpha >= 0 ? "+" : ""}${m.alpha}%`} info={GLOSSARY.alpha} tone={m.alpha >= 0 ? "up" : "down"} />
              <Metric label="CAGR" value={`${m.cagr}%`} info={GLOSSARY.cagr} tone={m.cagr >= 0 ? "up" : "down"} />
              <Metric label="Sharpe" value={m.sharpe} info={GLOSSARY.sharpe} tone={m.sharpe >= 1 ? "up" : "gray"} />
              <Metric label="Max Drawdown" value={`${m.max_drawdown}%`} info={GLOSSARY.maxDrawdown} tone="down" />
              <Metric label="Sortino" value={m.sortino} info={GLOSSARY.sortino} />
              <Metric label="Win Rate" value={`${m.win_rate}%`} info={GLOSSARY.winRate} />
              <Metric label="Profit Factor" value={m.profit_factor} info={GLOSSARY.profitFactor} />
              <Metric label="Trades" value={m.trades} />
              <Metric label="Exposure" value={`${m.exposure}%`} info={GLOSSARY.exposure} />
            </div>
            <p className="mt-3 text-xs text-gray-500">
              Buy &amp; hold: <span className="tnum text-gray-300">{b.total_return}%</span> · Sharpe <span className="tnum text-gray-300">{b.sharpe}</span> · MaxDD <span className="tnum text-gray-300">{b.max_drawdown}%</span>
            </p>
          </Card>
        )}
      </div>

      {/* RIGHT: charts */}
      <div className="space-y-6 xl:col-span-2">
        <Card className="card-pad">
          <div className="mb-1 flex items-center gap-1.5">
            <h3 className="text-base font-semibold text-white">Equity Curve — Strategy vs Buy &amp; Hold</h3>
            {loading && <Loader2 size={14} className="animate-spin text-brand-400" />}
            <InfoButton entry={GLOSSARY.backtest} accent="#34d399" size={15} />
          </div>
          <div className="mb-2 flex items-center gap-4 text-xs text-gray-400">
            <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 bg-brand-400" /> Strategy</span>
            <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 bg-gray-500" /> Buy &amp; Hold</span>
          </div>
          {!ok ? (
            <div className="flex h-[300px] items-center justify-center text-sm text-gray-500">{loading ? "Running backtest…" : "Adjust setup."}</div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={data.series} margin={{ top: 6, right: 14, left: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id="eq" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#34d399" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.08)" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 10 }} tickLine={false} axisLine={false} minTickGap={60} />
                <YAxis tickFormatter={kfmt} tick={{ fill: "#94a3b8", fontSize: 11 }} tickLine={false} axisLine={false} width={48} domain={["auto", "auto"]} />
                <Tooltip {...tip} formatter={(v, n) => [money(v), n === "equity" ? "Strategy" : "Buy & Hold"]} />
                <Area dataKey="equity" stroke="none" fill="url(#eq)" isAnimationActive={false} tooltipType="none" legendType="none" />
                <Line dataKey="benchmark" stroke="#64748b" strokeWidth={1.8} dot={false} isAnimationActive={false} />
                <Line dataKey="equity" stroke="#34d399" strokeWidth={2.4} dot={false} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card className="card-pad">
          <CardHeader title="Drawdown" subtitle="Strategy underwater curve" action={<InfoButton entry={GLOSSARY.maxDrawdown} size={14} accent="#60a5fa" />} />
          <CardBody>
            {ok ? (
              <ResponsiveContainer width="100%" height={170}>
                <AreaChart data={data.series} margin={{ top: 6, right: 14, left: 4, bottom: 0 }}>
                  <defs>
                    <linearGradient id="dd" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.05} />
                      <stop offset="100%" stopColor="#f43f5e" stopOpacity={0.4} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.08)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 10 }} tickLine={false} axisLine={false} minTickGap={60} />
                  <YAxis tickFormatter={(v) => `${v}%`} tick={{ fill: "#94a3b8", fontSize: 11 }} tickLine={false} axisLine={false} width={42} />
                  <Tooltip {...tip} formatter={(v) => [`${Number(v).toFixed(2)}%`, "Drawdown"]} />
                  <Area dataKey="drawdown" stroke="#f43f5e" strokeWidth={1.5} fill="url(#dd)" isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            ) : <div className="flex h-[170px] items-center justify-center text-gray-500">—</div>}
          </CardBody>
        </Card>

        <Card className="card-pad">
          <CardHeader title="Price & Trade Signals" subtitle="green = entry · red = exit" />
          <CardBody>
            {ok ? (
              <ResponsiveContainer width="100%" height={210}>
                <ComposedChart data={priceRows} margin={{ top: 6, right: 14, left: 4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.08)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 10 }} tickLine={false} axisLine={false} minTickGap={60} />
                  <YAxis tickFormatter={(v) => `$${Math.round(v)}`} tick={{ fill: "#94a3b8", fontSize: 11 }} tickLine={false} axisLine={false} width={48} domain={["auto", "auto"]} />
                  <Tooltip {...tip} formatter={(v) => [`$${Number(v).toFixed(2)}`, "Price"]} />
                  <Line dataKey="price" stroke="#60a5fa" strokeWidth={1.6} dot={false} isAnimationActive={false} />
                  <Line dataKey="buy" stroke="transparent" connectNulls={false} isAnimationActive={false} tooltipType="none" legendType="none" dot={{ r: 4, fill: "#34d399", stroke: "#0b1120", strokeWidth: 1 }} />
                  <Line dataKey="sell" stroke="transparent" connectNulls={false} isAnimationActive={false} tooltipType="none" legendType="none" dot={{ r: 4, fill: "#f43f5e", stroke: "#0b1120", strokeWidth: 1 }} />
                </ComposedChart>
              </ResponsiveContainer>
            ) : <div className="flex h-[210px] items-center justify-center text-gray-500">—</div>}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
