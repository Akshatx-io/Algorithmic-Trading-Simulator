import { TrendingUp, Gauge, TrendingDown, Trophy } from "lucide-react";
import usePerformance from "../hooks/usePerformance";
import EquityChart from "../components/charts/EquityChart";
import StatCard from "../components/ui/StatCard";
import InfoButton from "../components/ui/InfoButton";
import Card, { CardHeader, CardBody } from "../components/ui/Card";
import { GLOSSARY } from "../utils/glossary";

const pct = (v) => `${(Number(v || 0) * 100).toFixed(2)}%`;
const num = (v, d = 2) => Number(v || 0).toFixed(d);

export default function Performance() {
  const data = usePerformance();

  if (!data) {
    return (
      <div className="flex h-[300px] items-center justify-center text-gray-500">
        Loading performance…
      </div>
    );
  }

  const m = data.metrics || {};

  const secondary = [
    { label: "Volatility", value: pct(m.volatility), info: GLOSSARY.volatility },
    { label: "Profit Factor", value: num(m.profit_factor), info: GLOSSARY.profitFactor },
    { label: "Total Trades", value: num(m.total_trades, 0) },
    { label: "Avg Profit", value: `$${num(m.avg_profit)}` },
    { label: "Avg Loss", value: `$${num(m.avg_loss)}` },
  ];

  return (
    <div className="space-y-6">
      {/* PRIMARY KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Return"
          value={pct(m.total_return)}
          tone={Number(m.total_return) >= 0 ? "up" : "down"}
          icon={TrendingUp} info={GLOSSARY.totalReturn}
        />
        <StatCard
          label="Sharpe Ratio"
          value={num(m.sharpe_ratio)}
          tone={Number(m.sharpe_ratio) >= 1 ? "up" : "default"}
          icon={Gauge} info={GLOSSARY.sharpe}
          accent="accent"
        />
        <StatCard
          label="Max Drawdown"
          value={pct(m.max_drawdown)}
          tone="down"
          icon={TrendingDown} info={GLOSSARY.maxDrawdown}
        />
        <StatCard
          label="Win Rate"
          value={pct(m.win_rate)}
          tone={Number(m.win_rate) >= 0.5 ? "up" : "default"}
          icon={Trophy} info={GLOSSARY.winRate}
          accent="accent"
        />
      </div>

      {/* EQUITY CURVE */}
      <Card className="card-pad">
        <EquityChart />
      </Card>

      {/* TRADE STATISTICS */}
      <Card>
        <CardHeader title="Trade Statistics" subtitle="Aggregate execution metrics" />
        <CardBody>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {secondary.map((s) => (
              <div key={s.label} className="rounded-xl border border-line/70 bg-ink-900/60 p-4">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs text-gray-400">{s.label}</p>
                  {s.info && <InfoButton entry={s.info} size={12} />}
                </div>
                <p className="mt-1 text-lg font-medium tnum text-white">{s.value}</p>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
