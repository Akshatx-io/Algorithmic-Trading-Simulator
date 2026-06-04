/**
 * Central glossary of metric / concept explanations.
 *
 * Each entry feeds the InfoButton overlay: { title, subtitle?, what, formula?,
 * points?: string[], interpretation? }. Keep copy precise and technical — these
 * are the "deep dive" definitions surfaced via the ⓘ icons across the app.
 */
export const GLOSSARY = {
  optimizer: {
    title: "Smart Portfolio Optimizer",
    subtitle: "Monte-Carlo efficient frontier",
    what:
      "Simulates thousands of randomly-weighted, long-only portfolios over your chosen basket and evaluates each on annualized return, risk, and risk-adjusted return. It then surfaces the two canonical optima — the maximum-Sharpe (tangency) portfolio and the minimum-variance portfolio.",
    points: [
      "Each dot is one candidate portfolio (a set of weights summing to 100%).",
      "X-axis = volatility (risk); Y-axis = expected return. Up-and-left is better.",
      "Color encodes the Sharpe ratio — deep indigo (low) to radiant green (high).",
      "The upper-left boundary of the cloud is the efficient frontier: the best return achievable for each level of risk.",
    ],
    formula: "ret = wᵀμ · vol = √(wᵀΣw) · Sharpe = (ret − r_f) / vol",
    interpretation:
      "Use it to see the risk/return trade-off of a basket and to anchor allocation decisions on the two mathematically-optimal mixes rather than guesswork.",
  },
  efficientFrontier: {
    title: "Efficient Frontier",
    what:
      "The set of portfolios that deliver the highest expected return for a given level of risk (or the lowest risk for a given return). It forms the upper-left edge of the Monte-Carlo cloud.",
    points: [
      "Portfolios below the frontier are sub-optimal — you can get more return for the same risk.",
      "Moving along the frontier trades additional risk for additional return.",
    ],
    interpretation:
      "Rational allocations sit on the frontier; the right point depends on your risk tolerance.",
  },
  expectedReturn: {
    title: "Expected Return",
    what: "The portfolio's annualized mean return, estimated from historical daily returns.",
    formula: "ret = wᵀμ,  where μ = mean(daily returns) × 252",
    interpretation: "Higher is better, but must be weighed against the risk taken to achieve it.",
  },
  risk: {
    title: "Risk (Volatility)",
    what: "Annualized standard deviation of portfolio returns — how much the value swings.",
    formula: "vol = √(wᵀ Σ w),  where Σ = cov(daily returns) × 252",
    interpretation:
      "Lower volatility means a smoother equity curve. Diversification (low-correlation assets) reduces it.",
  },
  sharpe: {
    title: "Sharpe Ratio",
    what:
      "Risk-adjusted return: excess return per unit of volatility. The single best summary of 'quality' of returns.",
    formula: "Sharpe = (ret − r_f) / vol",
    points: [
      "< 1  — sub-par risk-adjusted return",
      "1–2 — good",
      "> 2  — excellent",
    ],
    interpretation: "Maximizing Sharpe finds the tangency portfolio — the best bang per unit of risk.",
  },
  maxSharpe: {
    title: "Max-Sharpe Portfolio",
    subtitle: "Tangency portfolio",
    what:
      "The simulated portfolio with the highest Sharpe ratio — the best risk-adjusted return in the basket.",
    interpretation:
      "Often the preferred allocation for return-seeking investors who still care about risk efficiency.",
  },
  minVol: {
    title: "Min-Volatility Portfolio",
    what: "The simulated portfolio with the lowest volatility — the calmest equity curve.",
    interpretation:
      "Preferred by risk-averse investors; usually gives up some return for materially lower drawdowns.",
  },
  // ---- Performance metrics ----
  totalReturn: {
    title: "Total Return",
    what: "Cumulative growth of account equity since inception, as a percentage of starting capital.",
    formula: "(equity_now − equity_start) / equity_start",
  },
  maxDrawdown: {
    title: "Max Drawdown",
    what: "The largest peak-to-trough decline in equity — the worst loss you'd have endured holding through.",
    formula: "max over time of (peak − equity) / peak",
    interpretation: "A key risk gauge; smaller is better. Big drawdowns are psychologically hard to hold.",
  },
  winRate: {
    title: "Win Rate",
    what: "Share of closed trades that were profitable.",
    interpretation: "High win rate isn't sufficient alone — a few large losses can still erase many small wins.",
  },
  volatility: {
    title: "Volatility",
    what: "Annualized standard deviation of returns — the dispersion of outcomes around the mean.",
    interpretation: "Higher volatility = wider range of likely results, both up and down.",
  },
  profitFactor: {
    title: "Profit Factor",
    what: "Gross profit divided by gross loss across all trades.",
    formula: "Σ winning P&L / |Σ losing P&L|",
    points: ["> 1 is profitable", "> 1.5 is strong", "< 1 loses money"],
  },
  // ---- Portfolio / position metrics ----
  equity: {
    title: "Equity",
    what: "Total account value = cash balance + mark-to-market value of all open positions.",
  },
  cash: {
    title: "Cash",
    what: "Uninvested buying power available to open new positions.",
  },
  totalPnl: {
    title: "Total P&L",
    what: "Realized plus unrealized profit and loss across the whole account.",
  },
  unrealizedPnl: {
    title: "Unrealized P&L",
    what: "Paper profit/loss on open positions at current market prices — not yet locked in.",
    formula: "(current_price − avg_price) × quantity",
    interpretation: "Fluctuates with price; becomes realized only when you close the position.",
  },
  realizedPnl: {
    title: "Realized P&L",
    what: "Profit/loss already locked in from closed trades (FIFO lot matching).",
  },
  avgPrice: {
    title: "Average Price",
    what: "Your cost basis — the average price paid across the lots that make up the position.",
  },
  marketValue: {
    title: "Market Value",
    what: "Current worth of the position = quantity × current price.",
  },
  totalCost: {
    title: "Total Cost",
    what: "What you paid for the position = quantity × average price.",
  },
  returnPct: {
    title: "Return %",
    what: "Unrealized gain/loss as a percentage of cost basis.",
    formula: "unrealized P&L / invested cost × 100",
  },
  // ---- Signal factors ----
  trend: {
    title: "Trend",
    what: "Directional strength from the gap between fast and slow EMAs.",
    formula: "(EMA_fast − EMA_slow) / EMA_slow",
    interpretation: "Positive = uptrend, negative = downtrend, near zero = range-bound.",
  },
  momentum: {
    title: "Momentum",
    what: "Centered RSI(14) — the speed and conviction of recent price moves.",
    formula: "(RSI − 50) / 50",
    interpretation: "Above 0 favors buyers; below 0 favors sellers.",
  },
};

export default GLOSSARY;
