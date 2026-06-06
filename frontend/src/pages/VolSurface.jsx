import { useEffect, useRef, useState } from "react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import { Box, Grid3x3, RotateCw, Layers, Loader2 } from "lucide-react";

import Card, { CardHeader, CardBody } from "../components/ui/Card";
import InfoButton from "../components/ui/InfoButton";
import VolSurface3D from "../components/ui/VolSurface3D";
import VolHeatmap from "../components/ui/VolHeatmap";
import { getVolSurface } from "../services/volService";
import { GLOSSARY } from "../utils/glossary";

const DEFAULTS = { spot: 100, rPct: 4, baseVolPct: 22, skew: -0.16, curv: 0.7, term: 0.05 };

function NumField({ label, value, onChange, step = "1", min }) {
  return (
    <div>
      <label className="mb-1 block text-xs text-gray-400">{label}</label>
      <input
        type="number" value={value} step={step} min={min}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-line bg-ink-900 px-3 py-2 text-sm text-white outline-none transition focus:border-brand-500/60 focus:ring-2 focus:ring-brand-500/20"
      />
    </div>
  );
}

function Chip({ label, value, info, tone = "brand" }) {
  const tint = { brand: "text-brand-300", up: "text-up", down: "text-down" }[tone];
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

export default function VolSurface() {
  const [form, setForm] = useState(DEFAULTS);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("3d");
  const [spin, setSpin] = useState(true);
  const timer = useRef(0);

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const d = await getVolSurface({
          s: Number(form.spot), r: Number(form.rPct) / 100,
          base_vol: Number(form.baseVolPct) / 100,
          skew: Number(form.skew), curv: Number(form.curv), term: Number(form.term),
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

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
      {/* LEFT: controls + stats */}
      <div className="space-y-6 xl:col-span-1">
        <Card className="card-pad">
          <div className="mb-4 flex items-center gap-1.5">
            <Layers size={16} className="text-brand-400" />
            <h3 className="text-base font-semibold text-white">Surface Inputs</h3>
            <InfoButton entry={GLOSSARY.volSurface} accent="#34d399" size={14} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <NumField label="Spot" value={form.spot} onChange={set("spot")} step="1" min="1" />
            <NumField label="Risk-free (%)" value={form.rPct} onChange={set("rPct")} step="0.25" />
            <NumField label="ATM Vol (%)" value={form.baseVolPct} onChange={set("baseVolPct")} step="1" min="1" />
            <NumField label="Term Slope" value={form.term} onChange={set("term")} step="0.01" />
            <NumField label="Skew" value={form.skew} onChange={set("skew")} step="0.02" />
            <NumField label="Smile (curv)" value={form.curv} onChange={set("curv")} step="0.05" min="0" />
          </div>

          {ok && (
            <div className="mt-4 grid grid-cols-3 gap-2">
              <Chip label="ATM Vol" value={`${data.atm_vol}%`} info={GLOSSARY.impliedVol} />
              <Chip label="1Y Skew" value={`${data.skew_1y > 0 ? "+" : ""}${data.skew_1y}`} info={GLOSSARY.volSkew} tone={data.skew_1y >= 0 ? "up" : "down"} />
              <Chip label="IV Range" value={`${data.zmin.toFixed(0)}-${data.zmax.toFixed(0)}%`} />
            </div>
          )}
        </Card>

        {ok && (
          <Card className="card-pad">
            <CardHeader title="ATM Term Structure" action={<InfoButton entry={GLOSSARY.termStructure} size={14} accent="#60a5fa" />} />
            <CardBody>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={data.atm_term} margin={{ top: 6, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.08)" vertical={false} />
                  <XAxis dataKey="t" tickFormatter={(v) => `${v}y`} tick={{ fill: "#94a3b8", fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tickFormatter={(v) => `${v}%`} tick={{ fill: "#94a3b8", fontSize: 11 }} tickLine={false} axisLine={false} width={42} domain={["auto", "auto"]} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#0b1120", border: "1px solid #334155", borderRadius: 8, color: "#e2e8f0" }}
                    formatter={(v) => [`${Number(v).toFixed(2)}%`, "ATM IV"]}
                    labelFormatter={(l) => `${l}y`}
                  />
                  <Line type="monotone" dataKey="iv" stroke="#34d399" strokeWidth={2.5} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardBody>
          </Card>
        )}
      </div>

      {/* RIGHT: surface */}
      <div className="xl:col-span-2">
        <Card className="card-pad">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              <h3 className="text-base font-semibold text-white">Implied Volatility Surface</h3>
              {loading && <Loader2 size={14} className="animate-spin text-brand-400" />}
              <InfoButton entry={GLOSSARY.volSurface} accent="#34d399" size={15} />
            </div>
            <div className="flex items-center gap-2">
              {view === "3d" && (
                <button
                  onClick={() => setSpin((s) => !s)}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
                    spin ? "border-brand-500/40 bg-brand-500/10 text-brand-300" : "border-line bg-ink-800 text-gray-400 hover:text-white"
                  }`}
                >
                  <RotateCw size={13} className={spin ? "animate-spin-slow" : ""} /> Auto-rotate
                </button>
              )}
              <div className="flex rounded-lg bg-ink-900 p-1">
                <button onClick={() => setView("3d")} className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${view === "3d" ? "bg-brand-500/20 text-white ring-1 ring-brand-500/30" : "text-gray-400 hover:text-white"}`}>
                  <Box size={13} /> 3D
                </button>
                <button onClick={() => setView("heat")} className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${view === "heat" ? "bg-brand-500/20 text-white ring-1 ring-brand-500/30" : "text-gray-400 hover:text-white"}`}>
                  <Grid3x3 size={13} /> Heatmap
                </button>
              </div>
            </div>
          </div>

          {!ok ? (
            <div className="flex h-[460px] items-center justify-center text-sm text-gray-500">
              {loading ? "Fitting surface…" : "Adjust inputs to build the surface."}
            </div>
          ) : view === "3d" ? (
            <VolSurface3D iv={data.iv} zmin={data.zmin} zmax={data.zmax} autoRotate={spin} height={460} />
          ) : (
            <VolHeatmap iv={data.iv} moneyness={data.moneyness} expiries={data.expiries} zmin={data.zmin} zmax={data.zmax} height={460} />
          )}
          <p className="mt-2 text-center text-xs text-gray-500">
            X: moneyness (strike / spot) · Y: time to expiry · {view === "3d" ? "Z & color" : "color"}: implied vol · drag to rotate
          </p>
        </Card>
      </div>
    </div>
  );
}
