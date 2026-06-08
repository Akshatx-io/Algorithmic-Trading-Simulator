import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import {
  Activity, Loader2, User, Lock, Eye, EyeOff, ArrowRight,
  Sigma, Box, LineChart, ShieldCheck,
} from "lucide-react";

import { login as apiLogin } from "../services/authService";

const FEATURES = [
  { icon: Sigma, title: "Monte Carlo option pricing", desc: "GBM simulation, Greeks & Black-Scholes — animated live." },
  { icon: Box, title: "3D volatility surface", desc: "SVI fit with Newton-Raphson implied-vol inversion." },
  { icon: LineChart, title: "Backtesting & ML signals", desc: "Sharpe, drawdown, and a from-scratch Random Forest." },
];

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
    setError("");
    setLoading(true);
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
    "peer w-full rounded-xl border border-line bg-ink-900/80 py-3 pl-11 pr-3 text-sm text-white outline-none transition placeholder:text-gray-600 focus:border-brand-500/60 focus:ring-4 focus:ring-brand-500/15";

  return (
    <div className="grid min-h-screen grid-cols-1 overflow-hidden bg-ink-950 text-gray-100 lg:grid-cols-[1.05fr_1fr]">
      {/* ───────────── Brand panel ───────────── */}
      <aside className="relative hidden flex-col justify-between overflow-hidden border-r border-line p-12 lg:flex">
        {/* animated aurora */}
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -left-24 -top-24 h-96 w-96 rounded-full bg-brand-500/25 blur-3xl animate-[float_11s_ease-in-out_infinite]" />
          <div className="absolute right-0 top-1/3 h-80 w-80 rounded-full bg-emerald-500/20 blur-3xl animate-[float_14s_ease-in-out_infinite_reverse]" />
          <div className="absolute bottom-0 left-1/4 h-72 w-72 rounded-full bg-sky-500/20 blur-3xl animate-[float_9s_ease-in-out_infinite]" />
          <div className="absolute inset-0 bg-grid-faint opacity-[0.35]" style={{ backgroundSize: "26px 26px" }} />
          <div className="absolute inset-0 bg-gradient-to-b from-ink-950/10 via-ink-950/40 to-ink-950" />
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
          <h1 className="text-4xl font-bold leading-tight tracking-tight text-white">
            The quant desk,
            <br />
            <span className="bg-gradient-to-r from-brand-300 via-emerald-300 to-sky-300 bg-clip-text text-transparent">
              in your browser.
            </span>
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-gray-400">
            Options, volatility surfaces, backtests and ML signals — every model built
            from first principles, every chart rendered at 60fps.
          </p>

          <div className="mt-8 space-y-4">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line/70 bg-ink-900/70 text-brand-300">
                    <Icon size={16} />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-white">{f.title}</p>
                    <p className="text-xs text-gray-500">{f.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-gray-500">
          <ShieldCheck size={14} className="text-brand-400" />
          Paper trading · simulated market data · no real money at risk
        </div>
      </aside>

      {/* ───────────── Form panel ───────────── */}
      <main className="relative flex items-center justify-center p-6 sm:p-10">
        <div className="pointer-events-none absolute inset-0 bg-grid-faint opacity-40 lg:hidden" style={{ backgroundSize: "22px 22px" }} />
        <div className="relative w-full max-w-sm animate-[fadeUp_0.6s_cubic-bezier(0.16,1,0.3,1)]">
          {/* mobile brand */}
          <div className="mb-8 flex flex-col items-center text-center lg:items-start lg:text-left">
            <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-gradient shadow-glow lg:hidden">
              <Activity size={22} className="text-white" />
            </span>
            <h2 className="text-2xl font-bold tracking-tight text-white">Welcome back</h2>
            <p className="mt-1 text-sm text-gray-400">Sign in to your paper trading account.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <div className="animate-[fadeUp_0.25s_ease-out] rounded-xl border border-down/30 bg-down/10 px-3.5 py-2.5 text-sm text-down">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="username" className="mb-1.5 block text-xs font-medium text-gray-400">Username</label>
              <div className="relative">
                <User size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 transition peer-focus:text-brand-400" />
                <input
                  id="username" type="text" autoComplete="username" placeholder="yourname"
                  className={field} value={username} onChange={(e) => setUsername(e.target.value)} required
                />
              </div>
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label htmlFor="password" className="block text-xs font-medium text-gray-400">Password</label>
                <button
                  type="button"
                  onClick={() => toast("Password reset isn't enabled in this demo — create a new account.", { icon: "🔑" })}
                  className="text-xs text-gray-500 transition hover:text-brand-300"
                >
                  Forgot?
                </button>
              </div>
              <div className="relative">
                <Lock size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  id="password" type={show ? "text" : "password"} autoComplete="current-password" placeholder="••••••••"
                  className={`${field} pr-11`} value={password} onChange={(e) => setPassword(e.target.value)} required
                />
                <button
                  type="button" onClick={() => setShow((s) => !s)}
                  aria-label={show ? "Hide password" : "Show password"}
                  className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-gray-500 transition hover:bg-ink-700/60 hover:text-white"
                >
                  {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <label className="flex cursor-pointer select-none items-center gap-2 text-xs text-gray-400">
              <input
                type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)}
                className="h-4 w-4 rounded border-line bg-ink-900 accent-brand-500"
              />
              Keep me signed in
            </label>

            <button
              type="submit" disabled={loading}
              className="group flex w-full items-center justify-center gap-2 rounded-xl bg-brand-gradient py-3 text-sm font-semibold text-white shadow-glow transition duration-200 hover:-translate-y-0.5 hover:opacity-95 active:translate-y-0 disabled:opacity-50"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : null}
              {loading ? "Signing in…" : "Sign in"}
              {!loading && <ArrowRight size={16} className="transition group-hover:translate-x-0.5" />}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-400">
            New to the terminal?{" "}
            <Link to="/register" className="font-medium text-brand-400 transition hover:text-brand-300">
              Create an account
            </Link>
          </p>
        </div>
      </main>

      <style>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes float {
          0%,100% { transform: translate(0,0) scale(1); }
          50% { transform: translate(20px,-24px) scale(1.06); }
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-\\[float_11s_ease-in-out_infinite\\],
          .animate-\\[float_14s_ease-in-out_infinite_reverse\\],
          .animate-\\[float_9s_ease-in-out_infinite\\] { animation: none; }
        }
      `}</style>
    </div>
  );
}
