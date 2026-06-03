import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Minus, Plus, Loader2 } from "lucide-react";

import { executeTrade } from "../../services/tradeService";
import { STOCK_SYMBOLS } from "../../utils/stockSymbols";
import { formatCurrency } from "../../utils/formatCurrency";

/**
 * OrderTicket — Buy/Sell order entry.
 *
 * Controlled `symbol` is owned by the parent (so the chart and ticket stay in
 * sync). Everything else (side, qty, order type, limit price) is local. The
 * backend is the source of truth for fills; this only does optimistic UX
 * (estimated cost, buying-power / share guards) and surfaces server errors.
 */
export default function OrderTicket({
  symbol,
  onSymbolChange,
  livePrice = 0,
  buyingPower = 0,
  sharesOwned = 0,
  onPlaced,
}) {
  const [side, setSide] = useState("BUY");
  const [qty, setQty] = useState(1);
  const [orderType, setOrderType] = useState("MARKET");
  const [limitPrice, setLimitPrice] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isBuy = side === "BUY";
  const refPrice = orderType === "LIMIT" && Number(limitPrice) > 0 ? Number(limitPrice) : livePrice;
  const estimated = useMemo(() => Number(qty) * Number(refPrice || 0), [qty, refPrice]);

  const validationError = useMemo(() => {
    if (!symbol) return "Select a symbol";
    if (!Number.isFinite(Number(qty)) || Number(qty) <= 0) return "Enter a quantity";
    if (orderType === "LIMIT" && !(Number(limitPrice) > 0)) return "Enter a limit price";
    if (isBuy && estimated > buyingPower) return "Insufficient buying power";
    if (!isBuy && Number(qty) > sharesOwned) return "Not enough shares to sell";
    return null;
  }, [symbol, qty, orderType, limitPrice, isBuy, estimated, buyingPower, sharesOwned]);

  const submit = async () => {
    if (submitting) return;
    if (validationError) {
      toast.error(validationError);
      return;
    }
    setSubmitting(true);
    try {
      const data = await executeTrade({
        symbol,
        action: side,
        quantity: Number(qty),
        order_type: orderType,
        limit_price: orderType === "LIMIT" ? Number(limitPrice) : null,
      });
      toast.success(
        `${data.action} ${data.quantity} ${data.symbol} @ ${formatCurrency(data.price)}`
      );
      setQty(1);
      setLimitPrice("");
      onPlaced?.(data);
    } catch (err) {
      toast.error(err.message || "Trade failed");
    } finally {
      setSubmitting(false);
    }
  };

  const stepQty = (d) => setQty((q) => Math.max(1, Math.round(Number(q) + d)));

  const inputCls =
    "w-full rounded-lg border border-line bg-ink-900 px-3 py-2 text-sm text-white outline-none transition focus:border-brand-500/60 focus:ring-2 focus:ring-brand-500/20";

  return (
    <div className="card card-pad">
      {/* Side toggle */}
      <div className="grid grid-cols-2 gap-2 rounded-xl bg-ink-900 p-1">
        <button
          onClick={() => setSide("BUY")}
          className={`rounded-lg py-2 text-sm font-semibold transition ${
            isBuy ? "bg-up/15 text-up ring-1 ring-up/40" : "text-gray-400 hover:text-white"
          }`}
        >
          Buy
        </button>
        <button
          onClick={() => setSide("SELL")}
          className={`rounded-lg py-2 text-sm font-semibold transition ${
            !isBuy ? "bg-down/15 text-down ring-1 ring-down/40" : "text-gray-400 hover:text-white"
          }`}
        >
          Sell
        </button>
      </div>

      {/* Symbol */}
      <div className="mt-4">
        <label className="mb-1 block text-xs text-gray-400">Symbol</label>
        <select
          value={symbol}
          onChange={(e) => onSymbolChange?.(e.target.value)}
          className={inputCls}
        >
          {STOCK_SYMBOLS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {/* Quantity with steppers */}
      <div className="mt-4">
        <label className="mb-1 block text-xs text-gray-400">Quantity</label>
        <div className="flex items-stretch gap-2">
          <button
            onClick={() => stepQty(-1)}
            className="flex w-10 items-center justify-center rounded-lg border border-line bg-ink-900 text-gray-300 transition hover:text-white"
            aria-label="Decrease quantity"
          >
            <Minus size={16} />
          </button>
          <input
            type="number"
            min="1"
            step="1"
            value={qty}
            onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
            className={`${inputCls} text-center`}
          />
          <button
            onClick={() => stepQty(1)}
            className="flex w-10 items-center justify-center rounded-lg border border-line bg-ink-900 text-gray-300 transition hover:text-white"
            aria-label="Increase quantity"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      {/* Order type */}
      <div className="mt-4">
        <label className="mb-1 block text-xs text-gray-400">Order type</label>
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-ink-900 p-1">
          {["MARKET", "LIMIT"].map((t) => (
            <button
              key={t}
              onClick={() => setOrderType(t)}
              className={`rounded-lg py-1.5 text-sm font-medium transition ${
                orderType === t
                  ? "bg-ink-700 text-white ring-1 ring-line"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              {t === "MARKET" ? "Market" : "Limit"}
            </button>
          ))}
        </div>
      </div>

      {orderType === "LIMIT" && (
        <div className="mt-3">
          <label className="mb-1 block text-xs text-gray-400">Limit price</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={limitPrice}
            placeholder={livePrice ? livePrice.toFixed(2) : "0.00"}
            onChange={(e) => setLimitPrice(e.target.value)}
            className={inputCls}
          />
        </div>
      )}

      {/* Summary */}
      <dl className="mt-5 space-y-2 rounded-xl border border-line/70 bg-ink-900/60 p-4 text-sm">
        <div className="flex justify-between">
          <dt className="text-gray-400">Market price</dt>
          <dd className="tnum text-white">{livePrice ? formatCurrency(livePrice) : "—"}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-gray-400">{isBuy ? "Estimated cost" : "Estimated proceeds"}</dt>
          <dd className="tnum font-semibold text-white">{formatCurrency(estimated)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-gray-400">Buying power</dt>
          <dd className="tnum text-gray-300">{formatCurrency(buyingPower)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-gray-400">Shares owned</dt>
          <dd className="tnum text-gray-300">{sharesOwned}</dd>
        </div>
      </dl>

      <button
        onClick={submit}
        disabled={submitting || !!validationError}
        className={`mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${
          isBuy ? "bg-up hover:bg-up/90" : "bg-down hover:bg-down/90"
        }`}
      >
        {submitting && <Loader2 size={16} className="animate-spin" />}
        {validationError || `${isBuy ? "Buy" : "Sell"} ${symbol}`}
      </button>
    </div>
  );
}
