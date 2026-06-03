import { useMemo } from "react";
import useMarket from "../../hooks/useMarket";
import { formatCurrency } from "../../utils/formatCurrency";

/**
 * PriceTicker — continuously scrolling market tape (marquee).
 *
 * UX: a financial tape should auto-rotate, never expose a scrollbar. We render
 * the symbol list twice back-to-back and translate by -50%, giving a seamless
 * infinite loop. Animation pauses on hover so users can read a quote.
 */

const MARQUEE_CSS = `
@keyframes ticker-scroll {
  0%   { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}
.ticker-track {
  display: inline-flex;
  flex-wrap: nowrap;
  will-change: transform;
  animation: ticker-scroll 40s linear infinite;
}
.ticker-mask:hover .ticker-track { animation-play-state: paused; }
@media (prefers-reduced-motion: reduce) {
  .ticker-track { animation: none; }
}
`;

function TickerItem({ item }) {
  const change = Number(item.change ?? 0);
  const up = change >= 0;
  return (
    <div className="mx-4 flex shrink-0 items-center gap-2 text-sm">
      <span className="font-semibold text-white">{item.symbol}</span>
      <span className="text-gray-300">{formatCurrency(item.price)}</span>
      <span className={up ? "text-emerald-400" : "text-red-400"}>
        {up ? "▲" : "▼"} {Math.abs(change).toFixed(2)}
      </span>
    </div>
  );
}

const PriceTicker = () => {
  const market = useMarket();

  // Duplicate the list so the -50% translate loops seamlessly.
  const loop = useMemo(() => {
    const items = Array.isArray(market) ? market.filter((m) => m?.symbol) : [];
    return items.length ? [...items, ...items] : [];
  }, [market]);

  if (!loop.length) {
    return (
      <div className="border-b border-gray-800 bg-gray-900 px-4 py-2 text-sm text-gray-500">
        Waiting for live market data…
      </div>
    );
  }

  return (
    <div className="ticker-mask relative overflow-hidden border-b border-gray-800 bg-gray-900 py-2">
      <style>{MARQUEE_CSS}</style>
      {/* edge fades for a premium tape look */}
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-gray-900 to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-gray-900 to-transparent" />
      <div className="ticker-track">
        {loop.map((item, i) => (
          <TickerItem key={`${item.symbol}-${i}`} item={item} />
        ))}
      </div>
    </div>
  );
};

export default PriceTicker;
