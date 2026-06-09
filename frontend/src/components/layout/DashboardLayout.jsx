import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Wallet,
  LineChart,
  ArrowRightLeft,
  Radar,
  Atom,
  Sparkles,
  Sigma,
  Box,
  CalendarClock,
  FlaskConical,
  BrainCircuit,
  MessageSquareText,
  LogOut,
  Activity,
  Rocket,
} from "lucide-react";

import useAuth from "../../hooks/useAuth";
import Topbar from "./Topbar";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/portfolio", label: "Portfolio", icon: Wallet },
  { to: "/performance", label: "Performance", icon: LineChart },
  { to: "/trade", label: "Trade", icon: ArrowRightLeft },
  { to: "/quant", label: "Quant Lab", icon: Atom },
  { to: "/regime", label: "Regime", icon: Radar },
  { to: "/optimizer", label: "Optimizer", icon: Sparkles },
  { to: "/options", label: "Options", icon: Sigma },
  { to: "/vol-surface", label: "Vol Surface", icon: Box },
  { to: "/vol-forecast", label: "Forecaster", icon: CalendarClock },
  { to: "/backtest", label: "Backtester", icon: FlaskConical },
  { to: "/predict", label: "Predictor", icon: BrainCircuit },
  { to: "/sentiment", label: "Sentiment", icon: MessageSquareText },
];

const META = {
  "/": ["Dashboard", "Your account at a glance"],
  "/portfolio": ["Portfolio", "Holdings, allocation & positions"],
  "/performance": ["Performance", "Risk-adjusted analytics"],
  "/trade": ["Trade", "Place simulated orders"],
  "/quant": ["Quantitative Research Lab", "Six quant modules, one workspace"],
  "/regime": ["Market Regime", "Bull / Bear / Sideways detection"],
  "/optimizer": ["Smart Portfolio Optimizer", "Monte-Carlo efficient frontier"],
  "/options": ["Monte Carlo Option Pricer", "GBM simulation + Black-Scholes"],
  "/vol-surface": ["Neural Volatility Surface", "Implied vol across strikes x expiries"],
  "/vol-forecast": ["Vol Surface Forecaster", "Today vs forecast with confidence band"],
  "/backtest": ["Strategy Backtester", "Rule-based strategy vs buy-and-hold"],
  "/predict": ["Stock Return Predictor", "Random Forest + Monte Carlo"],
  "/sentiment": ["Earnings-Call Sentiment", "Financial NLP + event study"],
  "/paper-account": ["Paper Account", "Your simulated trading account"],
  "/account": ["Account Settings", "Profile, security & preferences"],
};

export default function DashboardLayout() {
  const { logout, user } = useAuth();
  const location = useLocation();
  const [title, subtitle] = META[location.pathname] || ["Dashboard", ""];
  const initial = (user?.username || "U").charAt(0).toUpperCase();

  return (
    <div className="flex h-screen overflow-hidden bg-ink-950 text-gray-100">
      {/* Sidebar — full height, never scrolls with content */}
      <aside className="hidden h-screen w-64 shrink-0 flex-col border-r border-line bg-ink-900/80 lg:flex">
        <div className="flex items-center gap-2 px-6 py-5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-gradient shadow-glow">
            <Activity size={18} className="text-white" />
          </span>
          <div className="leading-tight">
            <p className="text-sm font-bold text-white">Algorithmic Trading</p>
            <p className="text-xs text-gray-400">Simulator</p>
          </div>
        </div>

        <nav className="mt-2 flex-1 space-y-0.5 overflow-y-auto px-3">
          {NAV.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition ${
                    isActive
                      ? "bg-brand-500/15 text-white ring-1 ring-brand-500/30"
                      : "text-gray-400 hover:bg-ink-700/60 hover:text-white"
                  }`
                }
              >
                <Icon size={18} />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="border-t border-line p-3">
          <div className="flex items-center gap-1">
            <NavLink
              to="/paper-account"
              className={({ isActive }) =>
                `flex min-w-0 flex-1 items-center gap-3 rounded-xl px-3 py-2 transition ${
                  isActive ? "bg-brand-500/15 ring-1 ring-brand-500/30" : "hover:bg-ink-700/60"
                }`
              }
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-gradient text-sm font-semibold text-white">
                {initial}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">
                  {user?.username || "Trader"}
                </p>
                <p className="text-xs text-gray-500">Paper account</p>
              </div>
            </NavLink>
            <button
              onClick={() => logout()}
              title="Log out"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-400 transition hover:bg-down/10 hover:text-down"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />

        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-line px-5 py-4 lg:px-8">
          <div>
            <h1 className="text-xl font-semibold text-white">{title}</h1>
            {subtitle && <p className="text-sm text-gray-400">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-gray-400 sm:inline">{user?.username}</span>
            <button
              onClick={() => logout()}
              className="rounded-lg border border-line bg-ink-800 px-3 py-1.5 text-sm text-gray-300 transition hover:border-down/40 hover:text-down"
            >
              Logout
            </button>
          </div>
        </header>

        <main
          className="flex-1 overflow-y-auto overflow-x-hidden bg-grid-faint p-5 lg:p-8"
          style={{ backgroundSize: "22px 22px" }}
        >
          {user?.username === "demo" && (
            <div className="mb-5 flex items-center gap-2.5 rounded-xl border border-brand-500/30 bg-brand-500/10 px-4 py-2.5 text-xs text-brand-200">
              <Rocket size={15} className="shrink-0" />
              <span>
                <strong className="font-semibold text-brand-100">Demo mode</strong> — explore everything freely. This is a shared, sandboxed account that resets whenever someone starts a new demo.
              </span>
            </div>
          )}
          <Outlet />
        </main>
      </div>
    </div>
  );
}
