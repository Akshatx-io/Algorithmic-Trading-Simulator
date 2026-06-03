import { useEffect, useMemo, useState } from "react";

import CandlestickChart from "../components/charts/CandlestickChart";
import OrderTicket from "../components/trading/OrderTicket";
import Card, { CardHeader } from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import useMarket from "../hooks/useMarket";
import usePortfolio from "../hooks/usePortfolio";
import { getTrades, subscribeTradeUpdates } from "../services/tradeService";
import { STOCK_SYMBOLS } from "../utils/stockSymbols";
import { formatCurrency } from "../utils/formatCurrency";

const n = (v) => (typeof v === "number" && !Number.isNaN(v) ? v : 0);
const TIMEFRAMES = ["1m", "5m", "15m"];

export default function Trade() {
  const market = useMarket();
  const { portfolio, refresh } = usePortfolio();

  const [symbol, setSymbol] = useState("AAPL");
  const [timeframe, setTimeframe] = useState("1m");
  const [trades, setTrades] = useState([]);

  const marketMap = useMemo(() => {
    const m = {};
    (Array.isArray(market) ? market : []).forEach((q) => {
      if (q?.symbol) m[q.symbol] = q;
    });
    return m;
  }, [market]);

  const quote = marketMap[symbol] || {};
  const livePrice = n(quote.price);
  const change = n(quote.change);
  const changePct = n(quote.change_pct);

  const sharesOwned = useMemo(() => {
    const positions = portfolio?.positions || [];
    const p = positions.find((x) => x.symbol === symbol);
    return n(p?.quantity);
  }, [portfolio, symbol]);
  const buyingPower = n(portfolio?.cash_balance);

  const loadTrades = () =>
    getTrades()
      .then((d) => setTrades(Array.isArray(d?.trades) ? d.trades.slice(0, 12) : []))
      .catch(() => {});

  useEffect(() => {
    loadTrades();
    const unsub = subscribeTradeUpdates(loadTrades);
    return () => unsub();
  }, []);

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
      {/* LEFT: quote + chart + trades */}
      <div className="space-y-6 xl:col-span-2">
        {/* Watchlist strip */}
        <Card className="card-pad">
          <div className="flex flex-wrap gap-2">
            {STOCK_SYMBOLS.map((s) => {
              const q = marketMap[s] || {};
              const up = n(q.change) >= 0;
              const active = s === symbol;
              return (
                <button
                  key={s}
                  onClick={() => setSymbol(s)}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition ${
                    active
                      ? "border-brand-500/40 bg-brand-500/10 text-white"
                      : "border-line bg-ink-900 text-gray-300 hover:border-line hover:bg-ink-700/60"
                  }`}
                >
                  <span className="font-semibold">{s}</span>
                  <span className="tnum text-gray-400">{q.price ? formatCurrency(q.price) : "—"}</span>
                  <span className={`tnum text-xs ${up ? "text-up" : "text-down"}`}>
                    {q.price ? `${up ? "+" : ""}${n(q.change).toFixed(2)}` : ""}
                  </span>
                </button>
              );
            })}
          </div>
        </Card>

        {/* Quote header */}
        <Card className="card-pad">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold text-white">{symbol}</h2>
                <Badge variant={change >= 0 ? "up" : "down"}>
                  {change >= 0 ? "▲" : "▼"} {Math.abs(changePct).toFixed(2)}%
                </Badge>
              </div>
              <p className="mt-1 text-3xl font-semibold tnum text-white">
                {livePrice ? formatCurrency(livePrice) : "—"}
              </p>
              <p className={`text-sm tnum ${change >= 0 ? "text-up" : "text-down"}`}>
                {change >= 0 ? "+" : ""}
                {change.toFixed(2)} today
              </p>
            </div>
            <div className="flex gap-1 rounded-xl bg-ink-900 p-1">
              {TIMEFRAMES.map((tf) => (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                    timeframe === tf ? "bg-ink-700 text-white ring-1 ring-line" : "text-gray-400 hover:text-white"
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-4">
            <CandlestickChart symbol={symbol} timeframe={timeframe} />
          </div>
        </Card>

        {/* Recent trades */}
        <Card>
          <CardHeader title="Recent Trades" subtitle="Your latest executions" />
          <div className="px-2 pb-2 pt-3">
            {trades.length === 0 ? (
              <div className="px-3 py-8 text-center text-sm text-gray-500">No trades yet.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                    <th className="px-3 py-2 font-medium">Symbol</th>
                    <th className="px-3 py-2 font-medium">Side</th>
                    <th className="px-3 py-2 text-right font-medium">Qty</th>
                    <th className="px-3 py-2 text-right font-medium">Price</th>
                    <th className="px-3 py-2 text-right font-medium">When</th>
                  </tr>
                </thead>
                <tbody>
                  {trades.map((t) => (
                    <tr key={t.id} className="border-t border-line/60">
                      <td className="px-3 py-2.5 font-semibold text-white">{t.symbol}</td>
                      <td className="px-3 py-2.5">
                        <Badge variant={t.action === "BUY" ? "buy" : "sell"}>{t.action}</Badge>
                      </td>
                      <td className="px-3 py-2.5 text-right tnum text-gray-300">{n(t.quantity)}</td>
                      <td className="px-3 py-2.5 text-right tnum text-gray-300">
                        {formatCurrency(n(t.price))}
                      </td>
                      <td className="px-3 py-2.5 text-right tnum text-gray-500">
                        {t.timestamp ? new Date(t.timestamp).toLocaleTimeString("en-US", {
                          hour: "2-digit",
                          minute: "2-digit",
                        }) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Card>
      </div>

      {/* RIGHT: order ticket */}
      <div className="xl:sticky xl:top-4 xl:self-start">
        <OrderTicket
          symbol={symbol}
          onSymbolChange={setSymbol}
          livePrice={livePrice}
          buyingPower={buyingPower}
          sharesOwned={sharesOwned}
          onPlaced={() => {
            refresh?.();
            loadTrades();
          }}
        />
      </div>
    </div>
  );
}
