import { useEffect, useState } from "react";
import { Dices, Loader2, Sigma } from "lucide-react";

import Card from "../components/ui/Card";
import InfoButton from "../components/ui/InfoButton";
import MonteCarloViz from "../components/ui/MonteCarloViz";
import { priceOption } from "../services/optionService";
import { GLOSSARY } from "../utils/glossary";

const usd = (n) =>
  `$${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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
  const [simId, setSimId] = useState(0);

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
        if (!mounted) return;
        setData(d);
        if (d?.status === "success") setSimId((s) => s + 1);
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

      {/* RIGHT: live animated simulation */}
      <div className="xl:col-span-2">
        <Card className="card-pad">
          <MonteCarloViz
            paths={ok ? data.paths : []}
            timeAxis={ok ? data.time_axis : []}
            histogram={ok ? data.histogram : []}
            strike={ok ? data.strike : Number(form.K)}
            kind={form.kind}
            runId={simId}
            infoEntry={GLOSSARY.optionPricer}
            loading={loading}
          />
        </Card>
      </div>
    </div>
  );
}
