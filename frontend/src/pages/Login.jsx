/**
 * Login page.
 *
 * Uses the Zustand-backed authService.login(), which writes the access
 * token + user into the store. ProtectedRoute / PublicOnlyRoute observe
 * the store and redirect reactively (audit 3.11).
 */

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

import { login as apiLogin } from "../services/authService";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
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
      const msg =
        err?.message ||
        err?.data?.detail ||
        "Invalid credentials";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <form
        onSubmit={handleLogin}
        className="bg-slate-900 p-8 rounded-xl w-96 shadow-lg border border-slate-800"
      >
        <h2 className="text-2xl mb-6 text-white font-semibold">Sign in</h2>

        {error && (
          <p className="text-red-400 text-sm mb-4 bg-red-950/40 border border-red-900 rounded px-3 py-2">
            {error}
          </p>
        )}

        <label className="block text-xs uppercase text-slate-400 mb-1">Username</label>
        <input
          type="text"
          autoComplete="username"
          className="w-full mb-4 p-2 rounded bg-slate-800 text-white border border-slate-700 focus:border-blue-500 focus:outline-none"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />

        <label className="block text-xs uppercase text-slate-400 mb-1">Password</label>
        <input
          type="password"
          autoComplete="current-password"
          className="w-full mb-6 p-2 rounded bg-slate-800 text-white border border-slate-700 focus:border-blue-500 focus:outline-none"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 bg-blue-600 rounded font-medium hover:bg-blue-500 disabled:opacity-50 transition"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>

        <p className="text-sm text-slate-400 mt-4 text-center">
          New here?{" "}
          <Link to="/register" className="text-blue-400 hover:text-blue-300">
            Create an account
          </Link>
        </p>
      </form>
    </div>
  );
}
