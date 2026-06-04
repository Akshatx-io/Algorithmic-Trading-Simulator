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
import { TrendingUp, TrendingDown, Minus, Layers, Info } from "lucide-react";

import Card, { CardHeader, CardBody } from "../components/ui/Card";
import Modal from "../components/ui/Modal";
import { getRegime } from "../services/regimeService";
import { STOCK_SYMBOLS } from "../utils/stockSymbols";

const INTERVALS = ["1d", "15m", "5m"];

// Radiant, SaaS-grade palette: each regime has a vivid solid + a lighter top
// stop for gradient bands, plus deep-dive copy for the info overlay.
const REGIME = {
  Bull: {
    color: "#10d98a",
    light: "#5eead4",
    icon: TrendingUp,
    tagline: "Sustained uptrend",
    info: {
      what:
        "A Bull regime is a persistent upward drift in price where demand outweighs supply. Higher highs and higher lows form, and dips are bought.",
      characteristics: [
        "Fast EMA trades above slow EMA (positive trend strength)",
        "Momentum (RSI) holds above 50 — buyers in control",
        "Volatility is typically moderate and orderly",
        "Pullbacks are shallow and short-lived",
      ],
      detection:
        "K-Means clusters bars in standardized [trend, volatility, momentum] space. The cluster with the highest mean trend strength is labelled Bull.",
      strategy:
        "Trend-following and long-biased exposure; add on pullbacks, trail stops, let winners run.",
      risk:
        "Complacency near tops; sharp mean-reversion when the trend exhausts. Watch for momentum divergence.",
    },
  },
  Sideways: {
    color: "#fbbf24",
    light: "#fde68a",
    icon: Minus,
    tagline: "Range-bound chop",
    info: {
      what:
        "A Sideways (range) regime is a balance between buyers and sellers. Price oscillates within a band with no durable directional edge.",
      characteristics: [
        "Trend strength near zero (EMAs intertwined)",
        "RSI hovers around 50 — no momentum conviction",
        "Support/resistance hold repeatedly",
        "Breakouts often fail and revert",
      ],
      detection:
        "The middle cluster by mean trend strength is labelled Sideways — neither strongly positive nor negative.",
      strategy:
        "Mean-reversion: fade band extremes, sell strength / buy weakness; keep tight targets.",
      risk:
        "False breakouts and whipsaws; a real regime change can begin as a 'failed' range.",
    },
  },
  Bear: {
    color: "#fb5d6d",
    light: "#fda4af",
    icon: TrendingDown,
    tagline: "Sustained downtrend",
    info: {
      what:
        "A Bear regime is a persistent decline where supply overwhelms demand. Lower highs and lower lows form, and rallies are sold.",
      characteristics: [
        "Fast EMA trades below slow EMA (negative trend strength)",
        "Momentum (RSI) holds below 50 — sellers in control",
        "Volatility is usually elevated (fear, gaps)",
        "Counter-trend rallies are sharp but fade",
      ],
      detection:
        "The cluster with the lowest mean trend strength is labelled Bear.",
      strategy:
        "Defensive: reduce exposure, raise cash, or hedge/short; respect that down moves are faster than up moves.",
      risk:
        "Violent bear-market rallies can squeeze shorts; avoid catching falling knives.",
    },
  },
};

const ORDER = ["Bull", "Sideways", "Bear"];

const fmtDate = (epoch) => {
  const d = new Date(Number(epoch) * 1000);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};
const fmtUsd = (n) =>
  `$${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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
  const c = REGIME[p.regime]?.color || "#94a3b8";
  return (
    <div className="rounded-lg border border-line bg-ink-950/95 px-3 py-2 text-sm shadow-xl">
      <p className="text-xs text-gray-400">{fmtDate(p.time)}</p>
      <p className="tnum text-white">{fmtUsd(p.close)}</p>
      <p className="text-xs font-medium" style={{ color: c }}>{p.regime}</p>
    </div>
  );
}

export default function MarketRegime() {
  const [symbol, setSymbol] = useState("AAPL");
  const [interval, setInterval] = useState("1d");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeInfo, setActiveInfo] = useState(null);

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
  const cur = REGIME[current];
  const CurIcon = cur?.icon || Layers;
  const dist = summary.distribution || {};
  const vol = summary.regime_volatility || {};

  const infoCfg = activeInfo ? REGIME[activeInfo] : null;

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
        <Card className="card-pad relative overflow-hidden">
          {cur && (
            <div
              className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full blur-3xl"
              style={{ backgroundColor: `${cur.color}33` }}
            />
          )}
          <p className="text-sm text-gray-400">Current Regime</p>
          <div className="mt-2 flex items-center gap-3">
            <span
              className="flex h-12 w-12 items-center justify-center rounded-xl"
              style={{ backgroundColor: `${cur?.color || "#64748b"}22`, color: cur?.color || "#94a3b8" }}
            >
              <CurIcon size={22} />
            </span>
            <div>
              <p className="text-2xl font-bold" style={{ color: cur?.color || "#fff" }}>{current}</p>
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
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-ink-900">
            {ORDER.map((r) => (
              <div
                key={r}
                style={{
                  width: `${dist[r] || 0}%`,
                  background: `linear-gradient(90deg, ${REGIME[r].light}, ${REGIME[r].color})`,
                }}
              />
            ))}
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {ORDER.map((r) => (
              <div key={r} className="relative rounded-xl border border-line/70 bg-ink-900/60 p-3">
                <button
                  onClick={() => setActiveInfo(r)}
                  className="absolute right-2 top-2 text-gray-500 transition hover:text-white"
                  aria-label={`About ${r} regime`}
                  title={`What is a ${r} regime?`}
                >
                  <Info size={15} />
                </button>
                <div className="flex items-center gap-2 text-sm">
                  <span
                    className="inline-block h-3 w-3 rounded-sm"
                    style={{ background: `linear-gradient(135deg, ${REGIME[r].light}, ${REGIME[r].color})` }}
                  />
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
        <CardHeader
          title={`${symbol} Price with Market Regimes`}
          subtitle="KMeans regime classification"
          action={<Layers size={18} className="text-accent-400" />}
        />
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
                <defs>
                  {ORDER.map((r) => (
                    <linearGradient key={r} id={`band-${r}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={REGIME[r].light} stopOpacity={0.32} />
                      <stop offset="100%" stopColor={REGIME[r].color} stopOpacity={0.05} />
                    </linearGradient>
                  ))}
                  <linearGradient id="priceLine" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#e2e8f0" />
                    <stop offset="100%" stopColor="#f8fafc" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.08)" vertical={false} />
                {segments.map((s, i) => (
                  <ReferenceArea
                    key={`${s.x1}-${i}`}
                    x1={s.x1}
                    x2={s.x2}
                    fill={`url(#band-${s.regime})`}
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
                <Line type="monotone" dataKey="close" stroke="url(#priceLine)" strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          )}

          <div className="mt-4 flex flex-wrap gap-4">
            {ORDER.map((r) => (
              <button
                key={r}
                onClick={() => setActiveInfo(r)}
                className="flex items-center gap-2 text-sm text-gray-400 transition hover:text-white"
              >
                <span
                  className="inline-block h-3 w-3 rounded-sm"
                  style={{ background: `linear-gradient(135deg, ${REGIME[r].light}, ${REGIME[r].color})` }}
                />
                {r}
                <Info size={13} className="opacity-60" />
              </button>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* DEEP-DIVE OVERLAY */}
      <Modal
        open={!!infoCfg}
        onClose={() => setActiveInfo(null)}
        title={activeInfo ? `${activeInfo} Regime` : ""}
        subtitle={infoCfg?.tagline}
        icon={infoCfg?.icon}
        accent={infoCfg?.color}
      >
        {infoCfg && (
          <div className="space-y-5 pt-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-line/70 bg-ink-900/60 p-3">
                <p className="text-xs text-gray-400">Share of history</p>
                <p className="text-lg font-semibold tnum text-white">{(dist[activeInfo] || 0).toFixed(1)}%</p>
              </div>
              <div className="rounded-xl border border-line/70 bg-ink-900/60 p-3">
                <p className="text-xs text-gray-400">Avg annualized vol</p>
                <p className="text-lg font-semibold tnum text-white">{(vol[activeInfo] || 0).toFixed(1)}%</p>
              </div>
            </div>

            <Section title="What it is">
              <p className="text-gray-300">{infoCfg.info.what}</p>
            </Section>

            <Section title="Key characteristics">
              <ul className="space-y-1.5">
                {infoCfg.info.characteristics.map((c) => (
                  <li key={c} className="flex gap-2 text-gray-300">
                    <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: infoCfg.color }} />
                    {c}
                  </li>
                ))}
              </ul>
            </Section>

            <Section title="How the model detects it">
              <p className="text-gray-300">{infoCfg.info.detection}</p>
            </Section>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Section title="Suggested approach">
                <p className="text-gray-300">{infoCfg.info.strategy}</p>
              </Section>
              <Section title="Risk notes">
                <p className="text-gray-300">{infoCfg.info.risk}</p>
              </Section>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</h4>
      {children}
    </div>
  );
}
