import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { Activity, Loader2 } from "lucide-react";

import { register as apiRegister } from "../services/authService";

export default function Register() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    if (loading) return;
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await apiRegister({ username: username.trim(), password });
      toast.success("Account created");
      navigate("/", { replace: true });
    } catch (err) {
      setError(err?.message || err?.data?.detail || "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  const inputCls =
    "w-full rounded-lg border border-line bg-ink-900 px-3 py-2.5 text-sm text-white outline-none transition focus:border-brand-500/60 focus:ring-2 focus:ring-brand-500/20";

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-950 bg-grid-faint p-4" style={{ backgroundSize: "22px 22px" }}>
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-gradient shadow-glow">
            <Activity size={22} className="text-white" />
          </span>
          <h1 className="text-xl font-bold text-white">Create your account</h1>
          <p className="text-sm text-gray-400">Start trading with $100,000 in paper funds</p>
        </div>

        <form onSubmit={handleSubmit} className="card card-pad space-y-4">
          {error && (
            <p className="rounded-lg border border-down/30 bg-down/10 px-3 py-2 text-sm text-down">
              {error}
            </p>
          )}
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wide text-gray-400">Username</label>
            <input type="text" autoComplete="username" className={inputCls} value={username} onChange={(e) => setUsername(e.target.value)} required />
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wide text-gray-400">Password</label>
            <input type="password" autoComplete="new-password" className={inputCls} value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wide text-gray-400">Confirm password</label>
            <input type="password" autoComplete="new-password" className={inputCls} value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-gradient py-2.5 text-sm font-semibold text-white shadow-glow transition hover:opacity-90 disabled:opacity-50"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            {loading ? "Creating account…" : "Sign up"}
          </button>
          <p className="text-center text-sm text-gray-400">
            Already have an account?{" "}
            <Link to="/login" className="text-brand-400 hover:text-brand-300">
              Log in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
