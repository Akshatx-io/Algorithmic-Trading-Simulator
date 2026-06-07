import { useEffect, useRef, useState } from "react";
import {
  ResponsiveContainer, ComposedChart, LineChart, Line, BarChart, Bar, Cell,
  ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, CartesianGrid, ReferenceLine,
} from "recharts";
import { MessageSquareText, Loader2, TrendingUp, TrendingDown, Sparkles } from "lucide-react";

import Card, { CardHeader, CardBody } from "../components/ui/Card";
import InfoButton from "../components/ui/InfoButton";
import { analyzeSentiment } from "../services/sentimentService";
import { GLOSSARY } from "../utils/glossary";

const SYMBOLS = ["AAPL", "MSFT", "NVDA", "AMZN", "GOOGL", "META", "TSLA", "NFLX", "AMD", "INTC", "UBER"];
const tip = { contentStyle: { backgroundColor: "#0b1120", border: "1px solid #334155", borderRadius: 8, color: "#e2e8f0" } };
const colorFor = (l) => (l === "Positive" ? "#34d399" : l === "Negative" ? "#f43f5e" : "#94a3b8");

function Stat({ label, value, info, tone = "gray" }) {
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

export default function Sentiment() {
  const [symbol, setSymbol] = useState("AAPL");
  const [text, setText] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const first = useRef(true);

  const run = async (sym, txt) => {
    setLoading(true);
    try { setData(await analyzeSentiment({ symbol: sym, text: txt || undefined })); }
    catch { setData({ status: "error" }); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (first.current) { first.current = false; run(symbol, ""); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSymbol = (v) => { setSymbol(v); setText(""); run(v, ""); };

  const ok = data?.status === "success";
  const sent = ok ? data.sentiment : {};
  const es = ok ? data.event_study : {};
  const sig = ok ? es.signal : {};
  const esRows = ok ? es.window.map((d, k) => ({
    day: d, pos: es.caar_positive[k], neg: es.caar_negative[k], neu: es.caar_neutral[k],
  })) : [];
  const markerPos = ok ? ((sent.score + 1) / 2) * 100 : 50;

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
      {/* LEFT: input + sentiment + keywords */}
      <div className="space-y-6 xl:col-span-1">
        <Card className="card-pad">
          <div className="mb-4 flex items-center gap-1.5">
            <MessageSquareText size={16} className="text-brand-400" />
            <h3 className="text-base font-semibold text-white">Transcript</h3>
            <InfoButton entry={GLOSSARY.sentiment} accent="#34d399" size={14} />
          </div>
          <div className="mb-3">
            <label className="mb-1 block text-xs text-gray-400">Company</label>
            <select value={symbol} onChange={(e) => onSymbol(e.target.value)} className="w-full rounded-lg border border-line bg-ink-900 px-3 py-2 text-sm text-white outline-none focus:border-brand-500/60 focus:ring-2 focus:ring-brand-500/20">
              {SYMBOLS.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
          </div>
          <label className="mb-1 block text-xs text-gray-400">Paste a transcript (or leave blank for a sample)</label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            placeholder="Paste earnings-call text here…"
            className="w-full resize-y rounded-lg border border-line bg-ink-900 px-3 py-2 text-sm text-white outline-none transition focus:border-brand-500/60 focus:ring-2 focus:ring-brand-500/20"
          />
          <button
            onClick={() => run(symbol, text)}
            disabled={loading}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-gradient py-2.5 text-sm font-semibold text-white shadow-glow transition hover:opacity-90 disabled:opacity-50"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {loading ? "Analyzing…" : "Analyze Sentiment"}
          </button>
        </Card>

        {ok && (
          <Card className="card-pad">
            <h3 className="mb-3 text-base font-semibold text-white">Document Sentiment</h3>
            <div className={`rounded-2xl border p-4 ${sent.label === "Positive" ? "border-up/30 bg-up/5" : sent.label === "Negative" ? "border-down/30 bg-down/5" : "border-line bg-ink-900/60"}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-400">{data.symbol} · {data.source === "sample" ? "sample call" : "custom text"}</p>
                  <p className={`text-2xl font-bold ${sent.label === "Positive" ? "text-up" : sent.label === "Negative" ? "text-down" : "text-gray-200"}`}>{sent.label}</p>
                </div>
                <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${sent.score >= 0 ? "bg-up/15 text-up" : "bg-down/15 text-down"}`}>
                  {sent.score >= 0 ? <TrendingUp size={22} /> : <TrendingDown size={22} />}
                </div>
              </div>
              {/* score track -1..+1 */}
              <div className="relative mt-4 h-2 w-full rounded-full bg-gradient-to-r from-down via-gray-600 to-up">
                <div className="absolute -top-1 h-4 w-1 rounded-full bg-white shadow" style={{ left: `calc(${markerPos}% - 2px)` }} />
              </div>
              <div className="mt-1 flex justify-between text-[10px] text-gray-500"><span>-1</span><span className="tnum text-gray-300">score {sent.score}</span><span>+1</span></div>
              <p className="mt-3 text-xs text-gray-400">Confidence <span className="tnum text-gray-200">{sent.confidence}%</span> · {sent.n_sentences} sentences ({sent.pos_sentences}+ / {sent.neu_sentences}o / {sent.neg_sentences}-)</p>
            </div>
          </Card>
        )}

        {ok && (
          <Card className="card-pad">
            <h3 className="mb-3 text-base font-semibold text-white">Top Keywords</h3>
            <p className="mb-1 text-xs text-gray-500">Positive</p>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {data.keywords.positive.length ? data.keywords.positive.map((k) => (
                <span key={k.word} className="rounded-md bg-up/10 px-2 py-0.5 text-xs text-up ring-1 ring-up/30">{k.word} <span className="text-up/60">{k.count}</span></span>
              )) : <span className="text-xs text-gray-600">—</span>}
            </div>
            <p className="mb-1 text-xs text-gray-500">Negative</p>
            <div className="flex flex-wrap gap-1.5">
              {data.keywords.negative.length ? data.keywords.negative.map((k) => (
                <span key={k.word} className="rounded-md bg-down/10 px-2 py-0.5 text-xs text-down ring-1 ring-down/30">{k.word} <span className="text-down/60">{k.count}</span></span>
              )) : <span className="text-xs text-gray-600">—</span>}
            </div>
          </Card>
        )}
      </div>

      {/* RIGHT: event study + signal + charts */}
      <div className="space-y-6 xl:col-span-2">
        <Card className="card-pad">
          <div className="mb-1 flex items-center gap-1.5">
            <h3 className="text-base font-semibold text-white">Event Study — Post-Earnings Drift (CAAR)</h3>
            {loading && <Loader2 size={14} className="animate-spin text-brand-400" />}
            <InfoButton entry={GLOSSARY.eventStudy} accent="#34d399" size={15} />
          </div>
          {ok && (
            <div className="mb-2 flex flex-wrap items-center gap-4 text-xs text-gray-400">
              <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 bg-up" /> Positive ({es.n_positive})</span>
              <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 bg-gray-500" /> Neutral ({es.n_neutral})</span>
              <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 bg-down" /> Negative ({es.n_negative})</span>
              <span className="text-gray-500">{es.n_events} events</span>
            </div>
          )}
          {!ok ? (
            <div className="flex h-[300px] items-center justify-center text-sm text-gray-500">{loading ? "Scoring text & running event study…" : "Analyze a transcript."}</div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={esRows} margin={{ top: 6, right: 14, left: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.08)" vertical={false} />
                <XAxis dataKey="day" tickFormatter={(v) => (v === 0 ? "0" : `${v > 0 ? "+" : ""}${v}`)} tick={{ fill: "#94a3b8", fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={(v) => `${v}%`} tick={{ fill: "#94a3b8", fontSize: 11 }} tickLine={false} axisLine={false} width={44} domain={["auto", "auto"]} />
                <Tooltip {...tip} formatter={(v, n) => [`${Number(v).toFixed(2)}%`, n === "pos" ? "Positive" : n === "neg" ? "Negative" : "Neutral"]} labelFormatter={(l) => `Day ${l > 0 ? "+" : ""}${l}`} />
                <ReferenceLine x={0} stroke="#64748b" strokeDasharray="4 4" label={{ value: "Earnings", fill: "#94a3b8", fontSize: 10, position: "insideTopRight" }} />
                <ReferenceLine y={0} stroke="#475569" />
                <Line dataKey="pos" stroke="#34d399" strokeWidth={2.4} dot={false} isAnimationActive={false} />
                <Line dataKey="neu" stroke="#94a3b8" strokeWidth={1.6} dot={false} isAnimationActive={false} />
                <Line dataKey="neg" stroke="#f43f5e" strokeWidth={2.4} dot={false} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </Card>

        {ok && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Info Coeff (IC)" value={sig.ic} info={GLOSSARY.infoCoeff} tone={sig.ic > 0 ? "up" : "down"} />
            <Stat label="Hit Rate" value={`${sig.hit_rate}%`} info={GLOSSARY.directionalAcc} tone={sig.hit_rate >= 52 ? "up" : "gray"} />
            <Stat label="Long-Short" value={`${sig.long_short >= 0 ? "+" : ""}${sig.long_short}%`} info={GLOSSARY.eventStudy} tone={sig.long_short >= 0 ? "up" : "down"} />
            <Stat label="t-Statistic" value={sig.t_stat} info={GLOSSARY.tStat} tone={Math.abs(sig.t_stat) >= 2 ? "up" : "gray"} />
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card className="card-pad">
            <CardHeader title="Sentence Distribution" subtitle="Across the transcript" />
            <CardBody>
              {ok ? (
                <ResponsiveContainer width="100%" height={230}>
                  <BarChart data={data.distribution} margin={{ top: 6, right: 14, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.08)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: "#94a3b8", fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} tickLine={false} axisLine={false} width={34} allowDecimals={false} />
                    <Tooltip {...tip} formatter={(v) => [v, "Sentences"]} cursor={{ fill: "rgba(148,163,184,0.06)" }} />
                    <Bar dataKey="count" radius={[3, 3, 0, 0]} isAnimationActive={false}>
                      {data.distribution.map((d) => <Cell key={d.label} fill={colorFor(d.label)} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : <div className="flex h-[230px] items-center justify-center text-gray-500">—</div>}
            </CardBody>
          </Card>

          <Card className="card-pad">
            <CardHeader title="Sentiment vs Forward Return" subtitle="Each point = one earnings event" action={<InfoButton entry={GLOSSARY.infoCoeff} size={14} accent="#60a5fa" />} />
            <CardBody>
              {ok ? (
                <ResponsiveContainer width="100%" height={230}>
                  <ScatterChart margin={{ top: 6, right: 16, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.08)" />
                    <XAxis type="number" dataKey="sentiment" name="Sentiment" tick={{ fill: "#94a3b8", fontSize: 10 }} tickLine={false} axisLine={false} domain={[-1, 1]} />
                    <YAxis type="number" dataKey="fwd_return" name="Fwd return" unit="%" tick={{ fill: "#94a3b8", fontSize: 10 }} tickLine={false} axisLine={false} width={40} />
                    <ZAxis range={[22, 22]} />
                    <Tooltip {...tip} cursor={{ strokeDasharray: "3 3" }} formatter={(v, n) => [n === "Fwd return" ? `${Number(v).toFixed(2)}%` : Number(v).toFixed(2), n]} />
                    <ReferenceLine x={0} stroke="#475569" /><ReferenceLine y={0} stroke="#475569" />
                    <Scatter data={es.scatter} fill="#a78bfa" fillOpacity={0.55} isAnimationActive={false} />
                  </ScatterChart>
                </ResponsiveContainer>
              ) : <div className="flex h-[230px] items-center justify-center text-gray-500">—</div>}
            </CardBody>
          </Card>
        </div>

        <Card className="card-pad">
          <CardHeader title="Sentiment Timeline" subtitle="Sentence-by-sentence polarity through the call" />
          <CardBody>
            {ok ? (
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={data.timeline} margin={{ top: 6, right: 14, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.08)" vertical={false} />
                  <XAxis dataKey="i" tick={{ fill: "#94a3b8", fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis domain={[-1, 1]} tick={{ fill: "#94a3b8", fontSize: 10 }} tickLine={false} axisLine={false} width={34} />
                  <Tooltip {...tip} formatter={(v) => [Number(v).toFixed(2), "Sentiment"]} labelFormatter={(l) => `Sentence ${l}`} />
                  <ReferenceLine y={0} stroke="#475569" />
                  <Line dataKey="score" stroke="#60a5fa" strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : <div className="flex h-[160px] items-center justify-center text-gray-500">—</div>}
          </CardBody>
        </Card>

        {ok && (data.highlights.positive.length > 0 || data.highlights.negative.length > 0) && (
          <Card className="card-pad">
            <h3 className="mb-3 text-base font-semibold text-white">Key Sentences</h3>
            <div className="space-y-2">
              {data.highlights.positive.map((h, i) => (
                <p key={`p${i}`} className="rounded-lg border-l-2 border-up bg-up/5 px-3 py-2 text-sm text-gray-300">{h}</p>
              ))}
              {data.highlights.negative.map((h, i) => (
                <p key={`n${i}`} className="rounded-lg border-l-2 border-down bg-down/5 px-3 py-2 text-sm text-gray-300">{h}</p>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
