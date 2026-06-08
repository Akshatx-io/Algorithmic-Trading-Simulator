import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { Loader2, User, Lock, ShieldCheck, Eye, EyeOff, ArrowRight, Activity, Check, Wallet } from "lucide-react";

import { register as apiRegister } from "../services/authService";
import AuthScene, { GlassCard, FIELD } from "../components/auth/AuthScene";

const STRENGTH = ["", "Weak", "Fair", "Good", "Strong"];
const STRENGTH_COLOR = ["bg-ink-700", "bg-down", "bg-amber-400", "bg-sky-400", "bg-up"];

function scorePassword(pw) {
  if (!pw) return 0;
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return Math.min(4, s);
}

export default function Register() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const strength = scorePassword(password);
  const match = confirm.length > 0 && confirm === password;

  async function handleSubmit(e) {
    e.preventDefault();
    if (loading) return;
    if (password.length < 8) { setError("Password must be at least 8 characters"); return; }
    if (password !== confirm) { setError("Passwords do not match"); return; }
    setError(""); setLoading(true);
    try {
      await apiRegister({ username: username.trim(), password });
      toast.success("Account created · $100,000 in paper funds");
      navigate("/", { replace: true });
    } catch (err) {
      setError(err?.message || err?.data?.detail || "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthScene>
      <div className="mb-8 flex flex-col items-center text-center lg:items-start lg:text-left">
        <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-gradient shadow-glow lg:hidden">
          <Activity size={22} className="text-white" />
        </span>
        <h2 className="text-2xl font-bold tracking-tight text-white">Create your account</h2>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-gray-400">
          <Wallet size={14} className="text-brand-400" /> Start with <span className="font-medium text-brand-300">$100,000</span> in paper funds.
        </p>
      </div>

      <GlassCard>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="animate-[fadeUp_0.25s_ease-out] rounded-xl border border-down/30 bg-down/10 px-3.5 py-2.5 text-sm text-down">{error}</div>}

          <div>
            <label htmlFor="username" className="mb-1.5 block text-xs font-medium text-gray-400">Username</label>
            <div className="relative">
              <User size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
              <input id="username" type="text" autoComplete="username" placeholder="pick a username" className={FIELD} value={username} onChange={(e) => setUsername(e.target.value)} required />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="mb-1.5 block text-xs font-medium text-gray-400">Password</label>
            <div className="relative">
              <Lock size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
              <input id="password" type={show ? "text" : "password"} autoComplete="new-password" placeholder="at least 8 characters" className={`${FIELD} pr-11`} value={password} onChange={(e) => setPassword(e.target.value)} required />
              <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"} className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-gray-500 transition hover:bg-ink-700/60 hover:text-white">
                {show ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {password && (
              <div className="mt-2 flex items-center gap-2">
                <div className="flex flex-1 gap-1">
                  {[0, 1, 2, 3].map((i) => (
                    <span key={i} className={`h-1 flex-1 rounded-full transition-colors ${i < strength ? STRENGTH_COLOR[strength] : "bg-ink-700"}`} />
                  ))}
                </div>
                <span className="w-12 text-right text-[10px] font-medium text-gray-400">{STRENGTH[strength]}</span>
              </div>
            )}
          </div>

          <div>
            <label htmlFor="confirm" className="mb-1.5 block text-xs font-medium text-gray-400">Confirm password</label>
            <div className="relative">
              <ShieldCheck size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
              <input id="confirm" type={show ? "text" : "password"} autoComplete="new-password" placeholder="re-enter password" className={`${FIELD} pr-11`} value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
              {match && <Check size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-up" />}
            </div>
          </div>

          <label className="flex cursor-pointer select-none items-start gap-2 text-xs text-gray-400">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-line bg-ink-900 accent-brand-500" required />
            <span>I understand this is a <span className="text-gray-300">paper-trading simulator</span> — no real money is involved.</span>
          </label>

          <button type="submit" disabled={loading || !agree} className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-brand-gradient py-3 text-sm font-semibold text-white shadow-glow transition duration-200 hover:-translate-y-0.5 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50">
            <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-[900ms] ease-out group-hover:translate-x-full" />
            {loading ? <Loader2 size={16} className="animate-spin" /> : null}
            <span className="relative">{loading ? "Creating account…" : "Create account"}</span>
            {!loading && <ArrowRight size={16} className="relative transition group-hover:translate-x-0.5" />}
          </button>
        </form>
      </GlassCard>

      <p className="mt-6 text-center text-sm text-gray-400">
        Already have an account?{" "}
        <Link to="/login" className="font-medium text-brand-400 transition hover:text-brand-300">Sign in</Link>
      </p>
    </AuthScene>
  );
}
