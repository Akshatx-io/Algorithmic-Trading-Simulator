import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import {
  Activity, Loader2, User, Lock, Eye, EyeOff, ArrowRight,
  Sigma, Box, LineChart, ShieldCheck, TrendingUp,
} from "lucide-react";

import { login as apiLogin } from "../services/authService";

const FEATURES = [
  { icon: Sigma, title: "Monte Carlo option pricing", desc: "GBM sims, Greeks & Black-Scholes — animated live." },
  { icon: Box, title: "3D volatility surface", desc: "SVI fit with Newton-Raphson IV inversion." },
  { icon: LineChart, title: "Backtests & ML signals", desc: "Sharpe, drawdown & a from-scratch Random Forest." },
];

/* Live streaming equity chart — pure canvas, ~30fps, self-contained. */
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

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleLogin(e) {
    e.preventDefault();
    if (loading) return;
    setError(""); setLoading(true);
    try {
      await apiLogin({ username: username.trim(), password });
      toast.success("Welcome back");
      navigate("/", { replace: true });
    } catch (err) {
      setError(err?.message || err?.data?.detail || "Invalid credentials");
    } finally {
      setLoading(false);
    }
  }

  const field =
    "w-full rounded-xl border border-line bg-ink-950/60 py-3 pl-11 pr-3 text-sm text-white outline-none transition placeholder:text-gray-600 focus:border-brand-500/70 focus:bg-ink-950 focus:ring-4 focus:ring-brand-500/15";

  return (
    <div className="relative grid min-h-screen grid-cols-1 overflow-hidden bg-ink-950 text-gray-100 lg:grid-cols-[1.05fr_1fr]">
      {/* grain + global glow */}
      <div
        className="pointer-events-none absolute inset-0 z-0 opacity-[0.05] mix-blend-soft-light"
        style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")" }}
      />

      {/* ───────────── Brand panel ───────────── */}
      <aside className="relative z-10 hidden flex-col justify-between overflow-hidden border-r border-line/80 p-10 xl:p-12 lg:flex">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -left-28 -top-28 h-[26rem] w-[26rem] rounded-full bg-brand-500/25 blur-[90px] animate-[floatA_13s_ease-in-out_infinite]" />
          <div className="absolute right-[-6rem] top-1/3 h-80 w-80 rounded-full bg-emerald-500/20 blur-[90px] animate-[floatA_17s_ease-in-out_infinite_reverse]" />
          <div className="absolute bottom-[-4rem] left-1/3 h-72 w-72 rounded-full bg-sky-500/20 blur-[90px] animate-[floatA_11s_ease-in-out_infinite]" />
          <div className="absolute inset-0 bg-grid-faint opacity-30" style={{ backgroundSize: "26px 26px" }} />
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
            <span className="bg-gradient-to-r from-brand-300 via-emerald-300 to-sky-300 bg-clip-text text-transparent">
              in your browser.
            </span>
          </h1>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-gray-400">
            Options, volatility surfaces, backtests and ML signals — every model from
            first principles, every chart at 60fps.
          </p>

          {/* floating product preview */}
          <div className="mt-9 hidden max-w-sm xl:block" style={{ transform: "perspective(1100px) rotateX(7deg) rotateY(-9deg)" }}>
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

      {/* ───────────── Form panel ───────────── */}
      <main className="relative z-10 flex items-center justify-center p-6 sm:p-10">
        <div className="relative w-full max-w-sm animate-[fadeUp_0.6s_cubic-bezier(0.16,1,0.3,1)]">
          <div className="mb-8 flex flex-col items-center text-center lg:items-start lg:text-left">
            <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-gradient shadow-glow lg:hidden">
              <Activity size={22} className="text-white" />
            </span>
            <h2 className="text-2xl font-bold tracking-tight text-white">Welcome back</h2>
            <p className="mt-1 text-sm text-gray-400">Sign in to your paper trading account.</p>
          </div>

          {/* glass card with animated gradient border */}
          <div className="relative overflow-hidden rounded-2xl p-px shadow-2xl">
            <div
              className="pointer-events-none absolute -inset-[150%] animate-[spin_9s_linear_infinite]"
              style={{ background: "conic-gradient(from 90deg, transparent 0deg, rgba(56,189,248,0.55) 40deg, transparent 110deg, transparent 250deg, rgba(52,211,153,0.55) 300deg, transparent 340deg)" }}
            />
            <div className="relative rounded-2xl bg-ink-900/85 p-6 backdrop-blur-xl sm:p-7">
              <form onSubmit={handleLogin} className="space-y-4">
                {error && (
                  <div className="animate-[fadeUp_0.25s_ease-out] rounded-xl border border-down/30 bg-down/10 px-3.5 py-2.5 text-sm text-down">{error}</div>
                )}

                <div>
                  <label htmlFor="username" className="mb-1.5 block text-xs font-medium text-gray-400">Username</label>
                  <div className="relative">
                    <User size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input id="username" type="text" autoComplete="username" placeholder="yourname" className={field} value={username} onChange={(e) => setUsername(e.target.value)} required />
                  </div>
                </div>

                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label htmlFor="password" className="block text-xs font-medium text-gray-400">Password</label>
                    <button type="button" onClick={() => toast("Password reset isn't enabled in this demo — create a new account.", { icon: "🔑" })} className="text-xs text-gray-500 transition hover:text-brand-300">Forgot?</button>
                  </div>
                  <div className="relative">
                    <Lock size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input id="password" type={show ? "text" : "password"} autoComplete="current-password" placeholder="••••••••" className={`${field} pr-11`} value={password} onChange={(e) => setPassword(e.target.value)} required />
                    <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"} className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-gray-500 transition hover:bg-ink-700/60 hover:text-white">
                      {show ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <label className="flex cursor-pointer select-none items-center gap-2 text-xs text-gray-400">
                  <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-4 w-4 rounded border-line bg-ink-900 accent-brand-500" />
                  Keep me signed in
                </label>

                <button type="submit" disabled={loading} className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-brand-gradient py-3 text-sm font-semibold text-white shadow-glow transition duration-200 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50">
                  <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-[900ms] ease-out group-hover:translate-x-full" />
                  {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                  <span className="relative">{loading ? "Signing in…" : "Sign in"}</span>
                  {!loading && <ArrowRight size={16} className="relative transition group-hover:translate-x-0.5" />}
                </button>
              </form>
            </div>
          </div>

          <p className="mt-6 text-center text-sm text-gray-400">
            New to the terminal?{" "}
            <Link to="/register" className="font-medium text-brand-400 transition hover:text-brand-300">Create an account</Link>
          </p>
        </div>
      </main>

      <style>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes floatY { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        @keyframes floatA { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(22px,-26px) scale(1.07); } }
        @media (prefers-reduced-motion: reduce) {
          [class*="animate-"] { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
