import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { Loader2, User, Lock, Eye, EyeOff, ArrowRight, Activity, CornerDownLeft, Rocket } from "lucide-react";

import { login as apiLogin, demoLogin } from "../services/authService";
import AuthScene, { GlassCard, FIELD } from "../components/auth/AuthScene";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);
  const [caps, setCaps] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const navigate = useNavigate();

  const capsCheck = (e) => { if (e.getModifierState) setCaps(e.getModifierState("CapsLock")); };

  async function handleLogin(e) {
    e.preventDefault();
    if (loading) return;
    setError(""); setLoading(true);
    try {
      await apiLogin({ username: username.trim(), password });
      toast.success("Welcome back");
      navigate("/", { replace: true });
    } catch (err) {
      setError(typeof err?.message === "string" ? err.message : "Invalid credentials");
    } finally {
      setLoading(false);
    }
  }

  async function handleDemo() {
    if (demoLoading) return;
    setError("");
    setDemoLoading(true);
    try {
      await demoLogin();
      toast.success("Welcome to the demo");
      navigate("/", { replace: true });
    } catch (err) {
      setError(typeof err?.message === "string" ? err.message : "Demo unavailable. Try again.");
    } finally {
      setDemoLoading(false);
    }
  }

  return (
    <AuthScene>
      <div className="mb-8 flex flex-col items-center text-center lg:items-start lg:text-left">
        <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-gradient shadow-glow lg:hidden">
          <Activity size={22} className="text-white" />
        </span>
        <h2 className="text-2xl font-bold tracking-tight text-white">Welcome back</h2>
        <p className="mt-1 text-sm text-gray-400">Sign in to your paper trading account.</p>
      </div>

      <GlassCard>
        <form onSubmit={handleLogin} className="space-y-4">
          {error && <div className="animate-[fadeUp_0.25s_ease-out] rounded-xl border border-down/30 bg-down/10 px-3.5 py-2.5 text-sm text-down">{error}</div>}

          <div>
            <label htmlFor="username" className="mb-1.5 block text-xs font-medium text-gray-400">Username</label>
            <div className="relative">
              <User size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
              <input id="username" type="text" autoComplete="username" placeholder="yourname" className={FIELD} value={username} onChange={(e) => setUsername(e.target.value)} required />
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label htmlFor="password" className="block text-xs font-medium text-gray-400">Password</label>
              <button type="button" onClick={() => toast("Password reset isn't enabled in this demo — create a new account.", { icon: "🔑" })} className="text-xs text-gray-500 transition hover:text-brand-300">Forgot?</button>
            </div>
            <div className="relative">
              <Lock size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
              <input id="password" type={show ? "text" : "password"} autoComplete="current-password" placeholder="••••••••" className={`${FIELD} pr-11`} value={password} onChange={(e) => setPassword(e.target.value)} onKeyUp={capsCheck} onKeyDown={capsCheck} required />
              <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"} className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-gray-500 transition hover:bg-ink-700/60 hover:text-white">
                {show ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {caps && <p className="mt-1.5 animate-[fadeUp_0.2s_ease-out] text-xs text-amber-400">⇪ Caps Lock is on</p>}
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

          <p className="flex items-center justify-center gap-1.5 text-[11px] text-gray-600">
            Press <kbd className="rounded border border-line bg-ink-950 px-1.5 py-0.5 font-sans text-[10px] text-gray-400"><CornerDownLeft size={10} className="inline" /> Enter</kbd> to sign in
          </p>
        </form>

        <div className="mt-5 flex items-center gap-3">
          <span className="h-px flex-1 bg-line" />
          <span className="text-[11px] uppercase tracking-wider text-gray-600">or</span>
          <span className="h-px flex-1 bg-line" />
        </div>

        <button
          type="button"
          onClick={handleDemo}
          disabled={demoLoading}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-brand-500/30 bg-brand-500/10 py-3 text-sm font-semibold text-brand-200 transition duration-200 hover:-translate-y-0.5 hover:bg-brand-500/15 active:translate-y-0 disabled:opacity-50">
          {demoLoading ? <Loader2 size={16} className="animate-spin" /> : <Rocket size={16} />}
          <span>{demoLoading ? "Loading demo…" : "Explore the live demo"}</span>
        </button>
        <p className="mt-2 text-center text-[11px] text-gray-600">No signup — jump straight into a populated account.</p>
      </GlassCard>

      <p className="mt-6 text-center text-sm text-gray-400">
        New to the terminal?{" "}
        <Link to="/register" className="font-medium text-brand-400 transition hover:text-brand-300">Create an account</Link>
      </p>
    </AuthScene>
  );
}
