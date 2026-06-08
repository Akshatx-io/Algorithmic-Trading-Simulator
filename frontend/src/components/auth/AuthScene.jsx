import { useEffect, useRef, useState } from "react";
import {
  Activity, ShieldCheck, TrendingUp, Sigma, Box, LineChart,
} from "lucide-react";

/* Shared input styling + glass card so Login and Register stay identical. */
export const FIELD =
  "w-full rounded-xl border border-line bg-ink-950/60 py-3 pl-11 pr-3 text-sm text-white outline-none transition placeholder:text-gray-600 focus:border-brand-500/70 focus:bg-ink-950 focus:ring-4 focus:ring-brand-500/15";

export function GlassCard({ children }) {
  return (
    <div className="relative overflow-hidden rounded-2xl p-px shadow-2xl">
      <div
        className="pointer-events-none absolute -inset-[150%] animate-[spin_9s_linear_infinite]"
        style={{ background: "conic-gradient(from 90deg, transparent 0deg, rgba(56,189,248,0.55) 40deg, transparent 110deg, transparent 250deg, rgba(52,211,153,0.55) 300deg, transparent 340deg)" }}
      />
      <div className="relative rounded-2xl bg-ink-900/85 p-6 backdrop-blur-xl sm:p-7">{children}</div>
    </div>
  );
}

const FEATURES = [
  { icon: Sigma, title: "Monte Carlo option pricing", desc: "GBM sims, Greeks & Black-Scholes — animated live." },
  { icon: Box, title: "3D volatility surface", desc: "SVI fit with Newton-Raphson IV inversion." },
  { icon: LineChart, title: "Backtests & ML signals", desc: "Sharpe, drawdown & a from-scratch Random Forest." },
];

const COMMANDS = [
  "price-option --mc 20000",
  "vol-surface --fit svi",
  "backtest --strategy ema",
  "predict --rf 80-trees",
  "sentiment --event-study",
];

function useTypewriter(words) {
  const [text, setText] = useState("");
  useEffect(() => {
    let to;
    let i = 0, pos = 0, phase = "type";
    const tick = () => {
      const w = words[i % words.length];
      if (phase === "type") {
        pos++; setText(w.slice(0, pos));
        if (pos >= w.length) { phase = "hold"; to = setTimeout(tick, 1500); return; }
        to = setTimeout(tick, 55);
      } else if (phase === "hold") {
        phase = "erase"; to = setTimeout(tick, 0);
      } else {
        pos--; setText(w.slice(0, Math.max(0, pos)));
        if (pos <= 0) { phase = "type"; i++; to = setTimeout(tick, 260); return; }
        to = setTimeout(tick, 28);
      }
    };
    to = setTimeout(tick, 500);
    return () => clearTimeout(to);
  }, [words]);
  return text;
}

/* Live streaming equity chart — pure canvas, self-contained. */
function MiniMarket() {
  const wrap = useRef(null);
  const cv = useRef(null);
  useEffect(() => {
    const box = wrap.current, c = cv.current;
    if (!box || !c) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const N = 90;
    const data = [];
    let v = 0.45;
    for (let i = 0; i < N; i++) { v += (Math.random() - 0.46) * 0.045; v = Math.max(0.18, Math.min(0.86, v)); data.push(v); }
    let W = 0, H = 0;
    const size = () => {
      W = box.clientWidth; H = box.clientHeight;
      c.width = W * dpr; c.height = H * dpr; c.style.width = `${W}px`; c.style.height = `${H}px`;
      c.getContext("2d").setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    size();
    const ro = new ResizeObserver(size); ro.observe(box);
    let raf = 0, last = 0;
    const X = (i) => (i / (N - 1)) * W;
    const Y = (val) => 8 + (1 - val) * (H - 16);
    const frame = (t) => {
      if (t - last > 60) {
        last = t;
        v += (Math.random() - 0.45) * 0.05; v = Math.max(0.18, Math.min(0.86, v));
        data.push(v); data.shift();
      }
      const ctx = c.getContext("2d");
      ctx.clearRect(0, 0, W, H);
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, "rgba(52,211,153,0.30)");
      grad.addColorStop(1, "rgba(52,211,153,0)");
      ctx.beginPath(); ctx.moveTo(0, H);
      data.forEach((val, i) => ctx.lineTo(X(i), Y(val)));
      ctx.lineTo(W, H); ctx.closePath(); ctx.fillStyle = grad; ctx.fill();
      ctx.beginPath();
      data.forEach((val, i) => (i ? ctx.lineTo(X(i), Y(val)) : ctx.moveTo(X(i), Y(val))));
      ctx.strokeStyle = "#34d399"; ctx.lineWidth = 1.8; ctx.lineJoin = "round"; ctx.stroke();
      const hx = X(N - 1), hy = Y(data[N - 1]);
      ctx.fillStyle = "rgba(52,211,153,0.25)"; ctx.beginPath(); ctx.arc(hx, hy, 5.5, 0, 6.283); ctx.fill();
      ctx.fillStyle = "#34d399"; ctx.beginPath(); ctx.arc(hx, hy, 2.4, 0, 6.283); ctx.fill();
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);
  return <div ref={wrap} className="h-[116px] w-full"><canvas ref={cv} className="block" /></div>;
}

const TILT_BASE = "perspective(1100px) rotateX(7deg) rotateY(-9deg)";

/* The full split-screen auth scene. Render the form column as children. */
export default function AuthScene({ children }) {
  const typed = useTypewriter(COMMANDS);
  const asideRef = useRef(null);
  const spotRef = useRef(null);
  const tiltRef = useRef(null);

  const onAsideMove = (e) => {
    const el = asideRef.current; if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - r.left}px`);
    el.style.setProperty("--my", `${e.clientY - r.top}px`);
    if (spotRef.current) spotRef.current.style.opacity = "1";
  };
  const onAsideLeave = () => { if (spotRef.current) spotRef.current.style.opacity = "0"; };
  const onTilt = (e) => {
    const el = tiltRef.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(1100px) rotateX(${7 - py * 11}deg) rotateY(${-9 + px * 13}deg)`;
  };
  const onTiltLeave = () => { if (tiltRef.current) tiltRef.current.style.transform = TILT_BASE; };

  return (
    <div className="relative grid min-h-screen grid-cols-1 overflow-hidden bg-ink-950 text-gray-100 lg:grid-cols-[1.05fr_1fr]">
      <div
        className="pointer-events-none absolute inset-0 z-0 opacity-[0.05] mix-blend-soft-light"
        style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")" }}
      />

      <aside
        ref={asideRef}
        onMouseMove={onAsideMove}
        onMouseLeave={onAsideLeave}
        className="relative z-10 hidden flex-col justify-between overflow-hidden border-r border-line/80 p-10 xl:p-12 lg:flex"
      >
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -left-28 -top-28 h-[26rem] w-[26rem] rounded-full bg-brand-500/25 blur-[90px] animate-[floatA_13s_ease-in-out_infinite]" />
          <div className="absolute right-[-6rem] top-1/3 h-80 w-80 rounded-full bg-emerald-500/20 blur-[90px] animate-[floatA_17s_ease-in-out_infinite_reverse]" />
          <div className="absolute bottom-[-4rem] left-1/3 h-72 w-72 rounded-full bg-sky-500/20 blur-[90px] animate-[floatA_11s_ease-in-out_infinite]" />
          <div className="absolute inset-0 bg-grid-faint opacity-30" style={{ backgroundSize: "26px 26px" }} />
          <div ref={spotRef} className="absolute inset-0 opacity-0 transition-opacity duration-300" style={{ background: "radial-gradient(360px circle at var(--mx,50%) var(--my,50%), rgba(56,189,248,0.13), transparent 65%)" }} />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-ink-950/30 to-ink-950" />
        </div>

        <div className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-gradient shadow-glow">
            <Activity size={20} className="text-white" />
          </span>
          <div className="leading-tight">
            <p className="text-sm font-bold text-white">AI Trading Terminal</p>
            <p className="text-xs text-gray-400">Quantitative Research Lab</p>
          </div>
        </div>

        <div className="max-w-md">
          <span className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-line/70 bg-ink-900/60 px-3 py-1 text-[11px] font-medium text-brand-300 backdrop-blur">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-400" /> Six quant modules · live
          </span>
          <h1 className="text-[2.6rem] font-bold leading-[1.05] tracking-tight text-white">
            The quant desk,
            <br />
            <span className="bg-gradient-to-r from-brand-300 via-emerald-300 to-sky-300 bg-clip-text text-transparent">in your browser.</span>
          </h1>

          <div className="mt-5 flex items-center gap-2 rounded-lg border border-line/60 bg-ink-950/70 px-3 py-2 font-mono text-[13px] backdrop-blur">
            <span className="text-brand-400">quant</span>
            <span className="text-gray-600">❯</span>
            <span className="text-gray-200">{typed}</span>
            <span className="ml-0.5 inline-block h-3.5 w-[2px] animate-[blink_1s_step-end_infinite] bg-brand-400" />
          </div>

          <div className="mt-8 hidden max-w-sm xl:block">
            <div ref={tiltRef} onMouseMove={onTilt} onMouseLeave={onTiltLeave} className="transition-transform duration-150 ease-out will-change-transform" style={{ transform: TILT_BASE }}>
              <div className="animate-[floatY_7s_ease-in-out_infinite] rounded-2xl border border-line/70 bg-ink-900/70 p-4 shadow-2xl backdrop-blur-md">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-white">AAPL · Equity</span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-up/10 px-1.5 py-0.5 text-[9px] font-semibold text-up ring-1 ring-up/30">
                      <span className="h-1 w-1 animate-pulse rounded-full bg-up" /> LIVE
                    </span>
                  </div>
                  <span className="tnum inline-flex items-center gap-0.5 text-xs font-semibold text-up"><TrendingUp size={12} /> +12.4%</span>
                </div>
                <MiniMarket />
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {[["Sharpe", "1.84"], ["Win rate", "61%"], ["Max DD", "-12%"]].map(([l, v]) => (
                    <div key={l} className="rounded-lg border border-line/60 bg-ink-950/50 px-2 py-1.5 text-center">
                      <p className="tnum text-xs font-semibold text-white">{v}</p>
                      <p className="text-[9px] uppercase tracking-wide text-gray-500">{l}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-9 space-y-3.5 xl:hidden">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line/70 bg-ink-900/70 text-brand-300"><Icon size={16} /></span>
                  <div><p className="text-sm font-medium text-white">{f.title}</p><p className="text-xs text-gray-500">{f.desc}</p></div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-500">
          <span className="inline-flex items-center gap-1.5"><ShieldCheck size={13} className="text-brand-400" /> Paper trading · no real money</span>
          <span className="text-gray-700">·</span>
          <span>Newton-Raphson IV</span>
          <span className="text-gray-700">·</span>
          <span>From-scratch NumPy ML</span>
        </div>
      </aside>

      <main className="relative z-10 flex items-center justify-center p-6 sm:p-10">
        <div className="relative w-full max-w-sm animate-[fadeUp_0.6s_cubic-bezier(0.16,1,0.3,1)]">{children}</div>
      </main>

      <style>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes floatY { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        @keyframes floatA { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(22px,-26px) scale(1.07); } }
        @keyframes blink { 0%,50% { opacity: 1; } 51%,100% { opacity: 0; } }
        @media (prefers-reduced-motion: reduce) { [class*="animate-"] { animation: none !important; } }
      `}</style>
    </div>
  );
}
