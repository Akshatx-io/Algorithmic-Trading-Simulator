import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  Mail,
  Hash,
  CalendarDays,
  Wallet,
  KeyRound,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  Cpu,
} from "lucide-react";

import Card, { CardHeader, CardBody } from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import useAuth from "../hooks/useAuth";
import { fetchMe, changePassword } from "../services/authService";
import { resetAccount } from "../services/portfolioService";
import { formatCurrency } from "../utils/formatCurrency";

const MIN_PW = 8;

function Field({ icon, label, value }) {
  const Icon = icon;
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line/70 bg-ink-900/60 px-4 py-3">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-ink-700 text-brand-400">
        <Icon size={16} />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-gray-400">{label}</p>
        <p className="truncate text-sm font-medium text-white">{value}</p>
      </div>
    </div>
  );
}

export default function Account() {
  const { user } = useAuth();
  const [me, setMe] = useState(user);
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    let mounted = true;
    fetchMe()
      .then((d) => mounted && setMe(d))
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  const memberSince = useMemo(() => {
    const d = me?.created_at ? new Date(me.created_at) : null;
    return d && !Number.isNaN(d.getTime())
      ? d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
      : "—";
  }, [me]);

  const initial = (me?.username || "U").charAt(0).toUpperCase();

  const submitPassword = async (e) => {
    e.preventDefault();
    if (pw.next.length < MIN_PW) {
      toast.error(`New password must be at least ${MIN_PW} characters`);
      return;
    }
    if (pw.next !== pw.confirm) {
      toast.error("New password and confirmation do not match");
      return;
    }
    setSaving(true);
    try {
      await changePassword({ currentPassword: pw.current, newPassword: pw.next });
      toast.success("Password updated");
      setPw({ current: "", next: "", confirm: "" });
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Could not change password");
    } finally {
      setSaving(false);
    }
  };

  const doReset = async () => {
    if (!window.confirm("Reset account? This permanently clears all positions, trades, and history, and restores your starting balance.")) {
      return;
    }
    setResetting(true);
    try {
      await resetAccount();
      const fresh = await fetchMe().catch(() => null);
      if (fresh) setMe(fresh);
      toast.success("Account reset to starting balance");
    } catch {
      toast.error("Reset failed");
    } finally {
      setResetting(false);
    }
  };

  const inputCls =
    "w-full rounded-lg border border-line bg-ink-900 px-3 py-2 text-sm text-white placeholder-gray-500 outline-none transition focus:border-brand-500/60 focus:ring-2 focus:ring-brand-500/20";

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* PROFILE */}
      <Card>
        <CardBody>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-gradient text-2xl font-bold text-white shadow-glow">
              {initial}
            </span>
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-semibold text-white">{me?.username || "Trader"}</h2>
                <Badge variant="brand">Paper account</Badge>
              </div>
              <p className="mt-1 text-sm text-gray-400">{me?.email || "No email on file"}</p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field icon={Hash} label="Account ID" value={`#${me?.id ?? "—"}`} />
            <Field icon={Mail} label="Email" value={me?.email || "—"} />
            <Field icon={CalendarDays} label="Member since" value={memberSince} />
            <Field icon={Wallet} label="Cash balance" value={formatCurrency(me?.balance ?? 0)} />
          </div>
        </CardBody>
      </Card>

      {/* SECURITY */}
      <Card>
        <CardHeader
          title="Security"
          subtitle="Change your password"
          action={<ShieldCheck size={18} className="text-brand-400" />}
        />
        <CardBody>
          <form onSubmit={submitPassword} className="grid max-w-xl grid-cols-1 gap-4">
            <div>
              <label className="mb-1 block text-xs text-gray-400">Current password</label>
              <input
                type="password"
                autoComplete="current-password"
                className={inputCls}
                value={pw.current}
                onChange={(e) => setPw((s) => ({ ...s, current: e.target.value }))}
                required
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-gray-400">New password</label>
                <input
                  type="password"
                  autoComplete="new-password"
                  className={inputCls}
                  value={pw.next}
                  onChange={(e) => setPw((s) => ({ ...s, next: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-400">Confirm new password</label>
                <input
                  type="password"
                  autoComplete="new-password"
                  className={inputCls}
                  value={pw.confirm}
                  onChange={(e) => setPw((s) => ({ ...s, confirm: e.target.value }))}
                  required
                />
              </div>
            </div>
            <div>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-brand-gradient px-4 py-2 text-sm font-semibold text-white shadow-glow transition hover:opacity-90 disabled:opacity-50"
              >
                <KeyRound size={16} />
                {saving ? "Updating…" : "Update password"}
              </button>
            </div>
          </form>
        </CardBody>
      </Card>

      {/* PREFERENCES (account configuration) */}
      <Card>
        <CardHeader title="Preferences" subtitle="Account configuration" action={<Cpu size={18} className="text-accent-400" />} />
        <CardBody>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field icon={Cpu} label="Market data" value="Simulated · 24/7" />
            <Field icon={Wallet} label="Base currency" value="USD" />
            <Field icon={Wallet} label="Starting balance" value={formatCurrency(100000)} />
          </div>
        </CardBody>
      </Card>

      {/* DANGER ZONE */}
      <Card className="border-down/30">
        <CardHeader
          title="Danger zone"
          subtitle="Irreversible actions"
          action={<AlertTriangle size={18} className="text-down" />}
        />
        <CardBody>
          <div className="flex flex-col items-start justify-between gap-4 rounded-xl border border-down/30 bg-down/5 p-4 sm:flex-row sm:items-center">
            <div>
              <p className="text-sm font-medium text-white">Reset paper account</p>
              <p className="text-sm text-gray-400">
                Clears all positions, trades, and equity history, and restores your {formatCurrency(100000)} starting balance.
              </p>
            </div>
            <button
              onClick={doReset}
              disabled={resetting}
              className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-down/40 bg-down/10 px-4 py-2 text-sm font-semibold text-down transition hover:bg-down/20 disabled:opacity-50"
            >
              <RefreshCw size={16} />
              {resetting ? "Resetting…" : "Reset account"}
            </button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
