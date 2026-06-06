import { memo, useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart, Line,
  BarChart, Bar, Cell,
  XAxis, YAxis, Tooltip, ReferenceLine, CartesianGrid,
} from "recharts";
import { Dices, Loader2, Sigma } from "lucide-react";

import Card, { CardHeader, CardBody } from "../components/ui/Card";
import InfoButton from "../components/ui/InfoButton";
import { priceOption } from "../services/optionService";
import { GLOSSARY } from "../utils/glossary";

const PATH_COLORS = ["#60a5fa", "#34d399", "#a78bfa", "#f472b6", "#fbbf24", "#22d3ee"];
const usd = (n) =>
  `$${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Memoized fan-of-paths chart — re-renders only when the simulation changes. */
const PathFan = memo(function PathFan({ rows, pathIds, strike }) {
  return (
    <ResponsiveContainer width="100%" height={360}>
      <LineChart data={rows} margin={{ top: 10, right: 16, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.07)" vertical={false} />
        <XAxis dataKey="t" type="number" domain={["dataMin", "dataMax"]}
          tickFormatter={(v) => `${Number(v).toFixed(2)}y`}
          tick={{ fill: "#94a3b8", fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={40} />
        <YAxis tickFormatter={(v) => `$${Math.round(v)}`} tick={{ fill: "#94a3b8", fontSize: 11 }}
          tickLine={false} axisLine={false} width={52} domain={["auto", "auto"]} />
        <ReferenceLine y={strike} stroke="#f43f5e" strokeDasharray="5 4"
          label={{ value: `Strike ${usd(strike)}`, fill: "#fb7185", fontSize: 11, position: "insideTopRight" }} />
        {pathIds.map((id, i) => (
          <Line key={id} type="monotone" dataKey={`p${id}`} stroke={PATH_COLORS[i % PATH_COLORS.length]}
            strokeWidth={1} strokeOpacity={0.4} dot={false} isAnimationActive={false} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
});

/** Memoized terminal-price histogram. */
const TerminalHist = memo(function TerminalHist({ data, strike }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.07)" vertical={false} />
        <XAxis dataKey="price" tickFormatter={(v) => `$${Math.round(v)}`}
          tick={{ fill: "#94a3b8", fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={28} />
        <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} tickLine={false} axisLine={false} width={40} />
        <Tooltip
          contentStyle={{ backgroundColor: "#0b1120", border: "1px solid #334155", borderRadius: "8px", color: "#e2e8f0" }}
          formatter={(v) => [v, "paths"]}
          labelFormatter={(l) => `S_T ~ ${usd(l)}`}
        />
        <ReferenceLine x={strike} stroke="#f43f5e" strokeDasharray="5 4" />
        <Bar dataKey="count" radius={[2, 2, 0, 0]} isAnimationActive={false}>
          {data.map((d) => (
            <Cell key={d.price} fill={d.price >= strike ? "#34d399" : "#475569"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
});

function NumField({ label, value, onChange, step = "1", min }) {
  return (
    <div>
      <label className="mb-1 block text-xs text-gray-400">{label}</label>
      <input
        type="number"
        value={value}
        step={step}
        min={min}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-line bg-ink-900 px-3 py-2 text-sm text-white outline-none transition focus:border-brand-500/60 focus:ring-2 focus:ring-brand-500/20"
      />
    </div>
  );
}

function GreekCard({ label, value, info }) {
  return (
    <div className="rounded-xl border border-line/70 bg-ink-900/60 p-3">
      <div className="flex items-center gap-1.5">
        <p className="text-xs text-gray-400">{label}</p>
        {info && <InfoButton entry={info} size={12} accent="#60a5fa" />}
      </div>
      <p className="mt-1 tnum text-lg font-semibold text-white">{value}</p>
    </div>
  );
}

const DEFAULTS = { S: 100, K: 100, T: 1, rPct: 5, volPct: 20, kind: "call", n: 20000 };

export default function OptionPricer() {
  const [form, setForm] = useState(DEFAULTS);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [runKey, setRunKey] = useState(0);

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      setLoading(true);
      try {
        const d = await priceOption({
          s: Number(form.S), k: Number(form.K), t: Number(form.T),
          r: Number(form.rPct) / 100, sigma: Number(form.volPct) / 100,
          kind: form.kind, n: Number(form.n),
        });
        if (mounted) setData(d);
      } catch {
        if (mounted) setData({ status: "error" });
      } finally {
        if (mounted) setLoading(false);
      }
    };
    run();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runKey]);

  const ok = data?.status === "success";

  const pathIds = useMemo(() => (ok ? data.paths.map((p) => p.id) : []), [data, ok]);
  const rows = useMemo(() => {
    if (!ok) return [];
    return data.time_axis.map((t, i) => {
      const row = { t };
      data.paths.forEach((p) => { row[`p${p.id}`] = p.values[i]; });
      return row;
    });
  }, [data, ok]);

  const nPaths = ok ? Number(data.inputs?.n_paths ?? form.n) : Number(form.n);

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
      {/* LEFT: inputs + results */}
      <div className="space-y-6 xl:col-span-1">
        <Card className="card-pad">
          <div className="mb-4 flex items-center gap-1.5">
            <Sigma size={16} className="text-brand-400" />
            <h3 className="text-base font-semibold text-white">Contract</h3>
            <InfoButton entry={GLOSSARY.optionPricer} accent="#34d399" size={14} />
          </div>

          <div className="mb-4 grid grid-cols-2 gap-2 rounded-xl bg-ink-900 p-1">
            {["call", "put"].map((kd) => (
              <button key={kd} onClick={() => set("kind")(kd)}
                className={`rounded-lg py-2 text-sm font-semibold capitalize transition ${
                  form.kind === kd
                    ? (kd === "call" ? "bg-up/15 text-up ring-1 ring-up/40" : "bg-down/15 text-down ring-1 ring-down/40")
                    : "text-gray-400 hover:text-white"
                }`}>
                {kd}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <NumField label="Spot (S0)" value={form.S} onChange={set("S")} step="1" min="0" />
            <NumField label="Strike (K)" value={form.K} onChange={set("K")} step="1" min="0" />
            <NumField label="Expiry (years)" value={form.T} onChange={set("T")} step="0.25" min="0" />
            <NumField label="Volatility (%)" value={form.volPct} onChange={set("volPct")} step="1" min="0" />
            <NumField label="Risk-free (%)" value={form.rPct} onChange={set("rPct")} step="0.25" />
            <NumField label="Paths" value={form.n} onChange={set("n")} step="1000" min="1000" />
          </div>

          <button onClick={() => setRunKey((k) => k + 1)} disabled={loading}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-gradient py-2.5 text-sm font-semibold text-white shadow-glow transition hover:opacity-90 disabled:opacity-50">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Dices size={16} />}
            {loading ? "Simulating..." : "Run Simulation"}
          </button>
        </Card>

        {ok && (
          <Card className="card-pad">
            <h3 className="mb-3 text-base font-semibold text-white">Valuation</h3>
            <div className="space-y-3">
              <div className="rounded-xl border border-brand-500/30 bg-brand-500/5 p-3">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs text-gray-400">Monte Carlo Price</p>
                  <InfoButton entry={GLOSSARY.mcPrice} size={12} />
                </div>
                <p className="tnum text-2xl font-bold text-brand-300">{usd(data.mc.price)}</p>
                <p className="tnum text-xs text-gray-500">95% CI [{usd(data.mc.ci_low)}, {usd(data.mc.ci_high)}]</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <GreekCard label="Black-Scholes" value={usd(data.black_scholes.price)} info={GLOSSARY.blackScholes} />
                <GreekCard label="Prob. ITM" value={`${data.prob_itm}%`} info={GLOSSARY.probItm} />
              </div>
            </div>

            <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-gray-500">Greeks</p>
            <div className="grid grid-cols-2 gap-3">
              <GreekCard label="Delta" value={data.greeks.delta} info={GLOSSARY.delta} />
              <GreekCard label="Gamma" value={data.greeks.gamma} info={GLOSSARY.gamma} />
              <GreekCard label="Vega" value={data.greeks.vega} info={GLOSSARY.vega} />
              <GreekCard label="Theta" value={data.greeks.theta} info={GLOSSARY.theta} />
              <GreekCard label="Rho" value={data.greeks.rho} info={GLOSSARY.rho} />
            </div>
          </Card>
        )}
      </div>

      {/* RIGHT: charts */}
      <div className="space-y-6 xl:col-span-2">
        <Card>
          <CardHeader
            title="Monte Carlo Price Paths"
            subtitle={ok ? `${nPaths.toLocaleString()} paths simulated` : "GBM simulation"}
            action={<InfoButton entry={GLOSSARY.optionPricer} accent="#34d399" size={16} />}
          />
          <CardBody>
            {loading ? (
              <div className="flex h-[360px] items-center justify-center text-gray-500">Simulating price paths...</div>
            ) : !ok ? (
              <div className="flex h-[360px] items-center justify-center text-gray-500">Adjust inputs and run the simulation.</div>
            ) : (
              <PathFan rows={rows} pathIds={pathIds} strike={data.strike} />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Terminal Price Distribution" subtitle="Simulated price at expiry; green = in-the-money" />
          <CardBody>
            {ok ? <TerminalHist data={data.histogram} strike={data.strike} /> : (
              <div className="flex h-[280px] items-center justify-center text-gray-500">-</div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
