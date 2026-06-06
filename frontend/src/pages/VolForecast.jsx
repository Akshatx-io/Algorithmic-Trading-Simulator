import { useEffect, useRef, useState } from "react";
import {
  ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import { TrendingUp, TrendingDown, CalendarClock, Box, Loader2, Activity } from "lucide-react";

import Card, { CardHeader, CardBody } from "../components/ui/Card";
import InfoButton from "../components/ui/InfoButton";
import VolSurface3D from "../components/ui/VolSurface3D";
import { getVolForecast } from "../services/volService";
import { GLOSSARY } from "../utils/glossary";

const DEFAULTS = { spot: 100, rPct: 4, baseVolPct: 22, skew: -0.16, curv: 0.7, term: 0.05, horizon: 5 };

function NumField({ label, value, onChange, step = "1", min, max }) {
  return (
    <div>
      <label className="mb-1 block text-xs text-gray-400">{label}</label>
      <input
        type="number" value={value} step={step} min={min} max={max}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-line bg-ink-900 px-3 py-2 text-sm text-white outline-none transition focus:border-brand-500/60 focus:ring-2 focus:ring-brand-500/20"
      />
    </div>
  );
}

function Chip({ label, value, info, tone = "brand" }) {
  const tint = { brand: "text-brand-300", up: "text-up", down: "text-down", gray: "text-white" }[tone];
  return (
    <div className="rounded-xl border border-line/70 bg-ink-900/60 px-3 py-2">
      <div className="flex items-center gap-1">
        <p className="text-[10px] uppercase tracking-wide text-gray-500">{label}</p>
        {info && <InfoButton entry={info} size={11} accent="#60a5fa" />}
      </div>
      <p className={`tnum text-base font-semibold ${tint}`}>{value}</p>
    </div>
  );
}

const tip = {
  contentStyle: { backgroundColor: "#0b1120", border: "1px solid #334155", borderRadius: 8, color: "#e2e8f0" },
};

export default function VolForecast() {
  const [form, setForm] = useState(DEFAULTS);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [surf, setSurf] = useState("forecast");
  const timer = useRef(0);

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const d = await getVolForecast({
          s: Number(form.spot), r: Number(form.rPct) / 100,
          base_vol: Number(form.baseVolPct) / 100,
          skew: Number(form.skew), curv: Number(form.curv), term: Number(form.term),
          horizon: Number(form.horizon),
        });
        setData(d);
      } catch {
        setData({ status: "error" });
      } finally {
        setLoading(false);
      }
    }, 260);
    return () => clearTimeout(timer.current);
  }, [form]);

  const ok = data?.status === "success";
  const termRows = ok ? data.atm_term.map((p) => ({ ...p, band: [p.lo, p.hi] })) : [];
  const pathRows = ok ? data.level_path.map((p) => ({ ...p, band: [p.lo, p.hi] })) : [];
  const dAtm = ok ? data.deltas.atm : 0;

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
      {/* LEFT: controls + stats */}
      <div className="space-y-6 xl:col-span-1">
        <Card className="card-pad">
          <div className="mb-4 flex items-center gap-1.5">
            <CalendarClock size={16} className="text-brand-400" />
            <h3 className="text-base font-semibold text-white">Forecast Inputs</h3>
            <InfoButton entry={GLOSSARY.volForecast} accent="#34d399" size={14} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <NumField label="Spot" value={form.spot} onChange={set("spot")} step="1" min="1" />
            <NumField label="Risk-free (%)" value={form.rPct} onChange={set("rPct")} step="0.25" />
            <NumField label="ATM Vol (%)" value={form.baseVolPct} onChange={set("baseVolPct")} step="1" min="1" />
            <NumField label="Term Slope" value={form.term} onChange={set("term")} step="0.01" />
            <NumField label="Skew" value={form.skew} onChange={set("skew")} step="0.02" />
            <NumField label="Smile (curv)" value={form.curv} onChange={set("curv")} step="0.05" min="0" />
            <NumField label="Horizon (days)" value={form.horizon} onChange={set("horizon")} step="1" min="1" max="30" />
          </div>

          {ok && (
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Chip label={`Forecast ATM (+${form.horizon}d)`} value={`${data.forecast_atm}% +/- ${data.band}`} info={GLOSSARY.forecastBand} />
              <Chip label="Δ ATM Vol" value={`${dAtm >= 0 ? "+" : ""}${dAtm}`} tone={dAtm >= 0 ? "up" : "down"} />
              <Chip label="Δ Skew" value={`${data.deltas.skew >= 0 ? "+" : ""}${data.deltas.skew}`} tone="gray" />
              <Chip label="Horizon" value={`${data.horizon} days`} tone="gray" />
            </div>
          )}
        </Card>

        {ok && (
          <Card className="card-pad">
            <CardHeader title="ATM Level Forecast Path" subtitle="Mean-reverting projection per day" action={<InfoButton entry={GLOSSARY.forecastBand} size={14} accent="#60a5fa" />} />
            <CardBody>
              <ResponsiveContainer width="100%" height={190}>
                <ComposedChart data={pathRows} margin={{ top: 6, right: 10, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.08)" vertical={false} />
                  <XAxis dataKey="day" tickFormatter={(v) => `${v}d`} tick={{ fill: "#94a3b8", fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tickFormatter={(v) => `${v}%`} tick={{ fill: "#94a3b8", fontSize: 11 }} tickLine={false} axisLine={false} width={42} domain={["auto", "auto"]} />
                  <Tooltip {...tip} formatter={(v, n) => [Array.isArray(v) ? `${v[0]}–${v[1]}%` : `${Number(v).toFixed(2)}%`, n === "band" ? "95% band" : "ATM vol"]} labelFormatter={(l) => `Day ${l}`} />
                  <Area dataKey="band" stroke="none" fill="#38bdf8" fillOpacity={0.14} isAnimationActive={false} />
                  <Line dataKey="level" stroke="#38bdf8" strokeWidth={2.5} dot={false} isAnimationActive={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </CardBody>
          </Card>
        )}
      </div>

      {/* RIGHT: overlay + surface */}
      <div className="space-y-6 xl:col-span-2">
        <Card className="card-pad">
          <div className="mb-1 flex items-center gap-1.5">
            <Activity size={16} className="text-brand-400" />
            <h3 className="text-base font-semibold text-white">Today vs Forecast — ATM Term Structure</h3>
            {loading && <Loader2 size={14} className="animate-spin text-brand-400" />}
            <InfoButton entry={GLOSSARY.volForecast} accent="#34d399" size={15} />
          </div>
          <div className="mb-2 flex items-center gap-4 text-xs text-gray-400">
            <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 bg-white" /> Today</span>
            <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 border-t-2 border-dashed border-brand-400" /> Forecast (+{form.horizon}d)</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-sm bg-brand-500/30" /> 95% band</span>
          </div>
          {!ok ? (
            <div className="flex h-[260px] items-center justify-center text-sm text-gray-500">{loading ? "Forecasting…" : "Adjust inputs."}</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={termRows} margin={{ top: 6, right: 12, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.08)" vertical={false} />
                <XAxis dataKey="t" tickFormatter={(v) => `${v}y`} tick={{ fill: "#94a3b8", fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={(v) => `${v}%`} tick={{ fill: "#94a3b8", fontSize: 11 }} tickLine={false} axisLine={false} width={44} domain={["auto", "auto"]} />
                <Tooltip {...tip} formatter={(v, n) => [Array.isArray(v) ? `${v[0]}–${v[1]}%` : `${Number(v).toFixed(2)}%`, n === "band" ? "95% band" : n === "current" ? "Today" : "Forecast"]} labelFormatter={(l) => `${l}y expiry`} />
                <Area dataKey="band" stroke="none" fill="#34d399" fillOpacity={0.13} isAnimationActive={false} />
                <Line dataKey="current" stroke="#e2e8f0" strokeWidth={2.5} dot={false} isAnimationActive={false} />
                <Line dataKey="forecast" stroke="#34d399" strokeWidth={2.5} strokeDasharray="6 4" dot={false} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card className="card-pad">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              <Box size={16} className="text-brand-400" />
              <h3 className="text-base font-semibold text-white">Surface View</h3>
            </div>
            <div className="flex rounded-lg bg-ink-900 p-1">
              <button onClick={() => setSurf("current")} className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${surf === "current" ? "bg-brand-500/20 text-white ring-1 ring-brand-500/30" : "text-gray-400 hover:text-white"}`}>Today</button>
              <button onClick={() => setSurf("forecast")} className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${surf === "forecast" ? "bg-brand-500/20 text-white ring-1 ring-brand-500/30" : "text-gray-400 hover:text-white"}`}>Forecast (+{form.horizon}d)</button>
            </div>
          </div>
          {ok ? (
            <VolSurface3D
              iv={surf === "forecast" ? data.forecast_iv : data.current_iv}
              zmin={data.zmin} zmax={data.zmax}
              moneyness={data.moneyness} expiries={data.expiries}
              autoRotate={false} height={430}
            />
          ) : (
            <div className="flex h-[430px] items-center justify-center text-sm text-gray-500">—</div>
          )}
          <p className="mt-2 text-center text-xs text-gray-500">Shared color scale · drag to rotate · {dAtm >= 0 ? "vol rising" : "vol mean-reverting lower"}</p>
        </Card>
      </div>
    </div>
  );
}
