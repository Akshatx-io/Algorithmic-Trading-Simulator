/**
 * Register page — companion to Login.
 *
 * Uses the Zustand-backed authService.register(), which writes the new user
 * + access token into the store. On success, redirect to dashboard.
 */

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

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
      const msg = err?.message || err?.data?.detail || "Registration failed";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <form
        onSubmit={handleSubmit}
        className="bg-slate-900 p-8 rounded-xl w-96 shadow-lg border border-slate-800"
      >
        <h2 className="text-2xl mb-6 text-white font-semibold">Create account</h2>

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
          autoComplete="new-password"
          className="w-full mb-4 p-2 rounded bg-slate-800 text-white border border-slate-700 focus:border-blue-500 focus:outline-none"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <label className="block text-xs uppercase text-slate-400 mb-1">Confirm password</label>
        <input
          type="password"
          autoComplete="new-password"
          className="w-full mb-6 p-2 rounded bg-slate-800 text-white border border-slate-700 focus:border-blue-500 focus:outline-none"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 bg-blue-600 rounded font-medium hover:bg-blue-500 disabled:opacity-50 transition"
        >
          {loading ? "Creating account..." : "Sign up"}
        </button>

        <p className="text-sm text-slate-400 mt-4 text-center">
          Already have an account?{" "}
          <Link to="/login" className="text-blue-400 hover:text-blue-300">
            Log in
          </Link>
        </p>
      </form>
    </div>
  );
}
