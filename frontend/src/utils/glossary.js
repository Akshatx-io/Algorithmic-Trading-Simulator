/**
 * Central glossary of metric / concept explanations. Each entry feeds the
 * InfoButton overlay: { title, subtitle?, what, formula?, points?, interpretation? }.
 */
export const GLOSSARY = {
  optimizer: {
    title: "Smart Portfolio Optimizer",
    subtitle: "Monte-Carlo efficient frontier",
    what: "Simulates thousands of randomly-weighted, long-only portfolios over your chosen basket and evaluates each on annualized return, risk, and risk-adjusted return. It then surfaces the maximum-Sharpe (tangency) and minimum-variance portfolios.",
    points: [
      "Each dot is one candidate portfolio (weights summing to 100%).",
      "X-axis = volatility (risk); Y-axis = expected return. Up-and-left is better.",
      "Color encodes the Sharpe ratio — deep indigo (low) to radiant green (high).",
      "The upper-left boundary is the efficient frontier: best return per unit of risk.",
    ],
    formula: "ret = wᵀμ · vol = √(wᵀΣw) · Sharpe = (ret - r_f) / vol",
    interpretation: "Anchor allocation decisions on the two mathematically-optimal mixes rather than guesswork.",
  },
  efficientFrontier: {
    title: "Efficient Frontier",
    what: "The set of portfolios delivering the highest expected return for a given level of risk. It forms the upper-left edge of the cloud.",
    points: [
      "Portfolios below the frontier are sub-optimal.",
      "Moving along the frontier trades risk for return.",
    ],
    interpretation: "Rational allocations sit on the frontier; the right point depends on your risk tolerance.",
  },
  expectedReturn: {
    title: "Expected Return",
    what: "The portfolio's annualized mean return, estimated from historical daily returns.",
    formula: "ret = wᵀμ,  μ = mean(daily returns) × 252",
    interpretation: "Higher is better, but weigh it against the risk taken.",
  },
  risk: {
    title: "Risk (Volatility)",
    what: "Annualized standard deviation of portfolio returns — how much the value swings.",
    formula: "vol = √(wᵀ Σ w),  Σ = cov(daily returns) × 252",
    interpretation: "Lower volatility = smoother equity curve. Diversification reduces it.",
  },
  sharpe: {
    title: "Sharpe Ratio",
    what: "Risk-adjusted return: excess return per unit of volatility.",
    formula: "Sharpe = (ret - r_f) / vol",
    points: ["< 1 — sub-par", "1-2 — good", "> 2 — excellent"],
    interpretation: "Maximizing Sharpe finds the tangency portfolio — best return per unit of risk.",
  },
  maxSharpe: {
    title: "Max-Sharpe Portfolio",
    subtitle: "Tangency portfolio",
    what: "The simulated portfolio with the highest Sharpe ratio — best risk-adjusted return.",
    interpretation: "Preferred by return-seekers who still care about risk efficiency.",
  },
  minVol: {
    title: "Min-Volatility Portfolio",
    what: "The simulated portfolio with the lowest volatility — the calmest equity curve.",
    interpretation: "Preferred by risk-averse investors; usually gives up some return for lower drawdowns.",
  },
  totalReturn: {
    title: "Total Return",
    what: "Cumulative growth of account equity since inception, as a percentage of starting capital.",
    formula: "(equity_now - equity_start) / equity_start",
  },
  maxDrawdown: {
    title: "Max Drawdown",
    what: "The largest peak-to-trough decline in equity — the worst loss holding through.",
    formula: "max over time of (peak - equity) / peak",
    interpretation: "A key risk gauge; smaller is better.",
  },
  winRate: {
    title: "Win Rate",
    what: "Share of closed trades that were profitable.",
    interpretation: "High win rate alone isn't enough — a few large losses can erase many small wins.",
  },
  volatility: {
    title: "Volatility",
    what: "Annualized standard deviation of returns — the dispersion of outcomes.",
    interpretation: "Higher volatility = wider range of likely results.",
  },
  profitFactor: {
    title: "Profit Factor",
    what: "Gross profit divided by gross loss across all trades.",
    formula: "Σ winning P&L / |Σ losing P&L|",
    points: ["> 1 is profitable", "> 1.5 is strong", "< 1 loses money"],
  },
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
    what: "Paper profit/loss on open positions at current prices — not yet locked in.",
    formula: "(current_price - avg_price) × quantity",
    interpretation: "Fluctuates with price; becomes realized only when you close the position.",
  },
  realizedPnl: {
    title: "Realized P&L",
    what: "Profit/loss already locked in from closed trades (FIFO lot matching).",
  },
  avgPrice: {
    title: "Average Price",
    what: "Your cost basis — the average price paid across the lots in the position.",
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
  trend: {
    title: "Trend",
    what: "Directional strength from the gap between fast and slow EMAs.",
    formula: "(EMA_fast - EMA_slow) / EMA_slow",
    interpretation: "Positive = uptrend, negative = downtrend, near zero = range-bound.",
  },
  momentum: {
    title: "Momentum",
    what: "Centered RSI(14) — the speed and conviction of recent price moves.",
    formula: "(RSI - 50) / 50",
    interpretation: "Above 0 favors buyers; below 0 favors sellers.",
  },
  optionPricer: {
    title: "Monte Carlo Option Pricer",
    subtitle: "GBM simulation + Black-Scholes",
    what: "Prices a European option by simulating thousands of terminal prices for the underlying under Geometric Brownian Motion (risk-neutral), then averaging and discounting the payoff. A closed-form Black-Scholes price is shown as the analytical benchmark.",
    formula: "S_T = S0·exp((r - ½σ²)T + σ√T·Z),  price = e^(-rT)·E[payoff]",
    points: [
      "Each faint line is one simulated price path of the underlying.",
      "The histogram is the distribution of simulated prices at expiry (S_T).",
      "The MC price should land within its 95% confidence interval of Black-Scholes.",
    ],
    interpretation: "Monte Carlo generalizes to exotic/path-dependent payoffs where no closed form exists.",
  },
  mcPrice: {
    title: "Monte Carlo Price",
    what: "Average discounted option payoff across all simulated paths, with a 95% confidence interval.",
    formula: "e^(-rT) · mean(payoff),  payoff = max(S_T - K, 0) for a call",
    interpretation: "A narrower CI means more precision. It converges to Black-Scholes as paths grow.",
  },
  blackScholes: {
    title: "Black-Scholes Price",
    what: "The closed-form analytical fair value of a European option — the theoretical benchmark.",
    interpretation: "If the MC estimate brackets this value, the simulation is calibrated correctly.",
  },
  delta: {
    title: "Delta",
    what: "Sensitivity of option price to a $1 move in the underlying.",
    formula: "∂V/∂S",
    interpretation: "Call delta 0 to 1, put delta -1 to 0. Around 0.5 means at-the-money.",
  },
  gamma: {
    title: "Gamma",
    what: "Rate of change of delta per $1 move — the curvature of the position.",
    formula: "∂²V/∂S²",
    interpretation: "Highest at-the-money near expiry; high gamma means delta shifts fast.",
  },
  vega: {
    title: "Vega",
    what: "Sensitivity of option price to a 1% change in implied volatility.",
    formula: "∂V/∂σ",
    interpretation: "Long options are long vega — they gain value when volatility rises.",
  },
  theta: {
    title: "Theta",
    what: "Time decay — how much value the option loses per day, all else equal.",
    formula: "∂V/∂t (per day)",
    interpretation: "Usually negative for long options; the cost of holding optionality.",
  },
  rho: {
    title: "Rho",
    what: "Sensitivity of option price to a 1% change in the risk-free interest rate.",
    formula: "∂V/∂r",
  },
  probItm: {
    title: "Probability ITM",
    what: "Share of simulated paths where the option finished in-the-money (positive payoff).",
    interpretation: "A simulation-based estimate of expiring with intrinsic value.",
  },
  volSurface: {
    title: "Neural Volatility Surface",
    subtitle: "Implied vol across strikes x expiries",
    what:
      "Each point is the Black-Scholes implied volatility that reprices a European option at a given strike and expiry. The surface is reconstructed by inverting a parametric market-price grid with a Newton-Raphson solver, then smoothed into a clean fit.",
    points: [
      "X axis = moneyness (strike / spot); Y axis = time to expiry; Z / color = implied vol.",
      "The downward tilt toward low strikes is the equity skew (crash insurance is dear).",
      "Vol rising with maturity is the term structure of volatility.",
    ],
    interpretation:
      "Desks price and risk-manage every option off this surface; its shape encodes the market's view of future risk.",
  },
  impliedVol: {
    title: "Implied Volatility",
    what: "The volatility input that makes the Black-Scholes price equal the observed market price.",
    formula: "solve sigma: BS(S,K,T,r,sigma) = market price",
    interpretation: "Higher implied vol = richer option premium = more expected movement priced in.",
  },
  volSkew: {
    title: "Volatility Skew",
    what: "The slope of implied vol across strikes at a fixed expiry. Equity markets skew negative - low strikes carry higher vol.",
    formula: "IV(90% strike) - IV(110% strike)",
    interpretation: "A steeper skew signals stronger demand for downside protection.",
  },
  termStructure: {
    title: "ATM Term Structure",
    what: "At-the-money implied vol as a function of time to expiry.",
    interpretation: "Upward-sloping = calm now, more uncertainty later; inverted = near-term stress.",
  },
  volForecast: {
    title: "Vol Surface Forecaster",
    subtitle: "AR(1) factor dynamics + confidence band",
    what:
      "Forecasts how the implied-vol surface evolves over the next few days. Surface dynamics are decomposed into three interpretable factors - ATM level, skew, and term slope - each modeled as a mean-reverting AR(1) / Ornstein-Uhlenbeck process fit to its history. The factors are forecast h days ahead and the surface is rebuilt from them.",
    points: [
      "Solid line = today; dashed = forecast. The shaded band is the 95% confidence interval.",
      "Vol mean-reverts: high vol drifts down toward its long-run level, low vol drifts up.",
      "The band widens with horizon as forecast uncertainty compounds.",
    ],
    interpretation:
      "Forecasting the surface lets a desk pre-position vega and hedge gamma before the move, not after.",
  },
  forecastBand: {
    title: "95% Confidence Band",
    what: "The range the forecast ATM vol is expected to fall within 95% of the time, from the AR(1) forecast variance.",
    formula: "Var(h) = sigma^2 (1 - phi^2h) / (1 - phi^2)",
    interpretation: "Wider band = less certainty. It grows with the forecast horizon.",
  },
  backtest: {
    title: "Strategy Backtester",
    subtitle: "Rule-based strategy vs buy-and-hold",
    what:
      "Simulates a trading rule bar-by-bar over historical prices with realistic transaction costs, then compares the resulting equity curve against simply buying and holding the asset. Signals are shifted one bar before they trade, so there is no lookahead bias.",
    points: [
      "Equity curve = how $100k would have grown following the strategy.",
      "The benchmark is buy-and-hold of the same asset over the same window.",
      "Alpha is the strategy total return minus the benchmark total return.",
    ],
    interpretation:
      "A good strategy beats buy-and-hold on a risk-adjusted basis (higher Sharpe, shallower drawdown), not just on raw return.",
  },
  cagr: {
    title: "CAGR",
    what: "Compound annual growth rate - the smoothed yearly return that would produce the same final equity.",
    formula: "(end / start)^(1/years) - 1",
  },
  sortino: {
    title: "Sortino Ratio",
    what: "Like Sharpe, but penalizes only downside volatility - it ignores upside swings.",
    formula: "mean return / downside deviation x sqrt(252)",
    interpretation: "Higher is better; rewards strategies whose volatility is mostly to the upside.",
  },
  calmar: {
    title: "Calmar Ratio",
    what: "Annualized return divided by the worst drawdown - return earned per unit of pain.",
    formula: "CAGR / |max drawdown|",
    interpretation: "Above ~1 is solid; above 3 is excellent.",
  },
  alpha: {
    title: "Alpha vs Buy-and-Hold",
    what: "Excess total return of the strategy over simply buying and holding the asset.",
    interpretation: "Positive alpha means the timing rules added value beyond the market move.",
  },
  exposure: {
    title: "Exposure",
    what: "Share of the backtest period the strategy was actually invested (in the market).",
    interpretation: "Lower exposure with similar returns means capital was at risk less of the time.",
  },
  predictor: {
    title: "Stock Return Predictor",
    subtitle: "Random Forest + Monte Carlo",
    what:
      "Engineers features from price/volume history (lagged returns, moving-average ratios, rolling volatility, RSI, momentum, volume z-score) and trains a Random Forest to predict the next day's return. The model is evaluated strictly out-of-sample (time-ordered split, no leakage), then traded long/short and stress-tested with Monte Carlo bootstrap resampling.",
    points: [
      "Daily returns are near-random: an R-squared close to 0 and ~52-55% directional accuracy is realistic and honest.",
      "The edge, if any, shows up in directional accuracy and information coefficient, not raw R-squared.",
      "Monte Carlo resampling gives a distribution of outcomes instead of one lucky equity curve.",
    ],
    interpretation:
      "A small but consistent directional edge, compounded with risk control, is what real systematic desks harvest.",
  },
  directionalAcc: {
    title: "Directional Accuracy",
    what: "Share of test days where the model predicted the correct sign (up vs down) of the next return.",
    interpretation: "50% is a coin flip. Anything consistently above ~52% is a genuine (if small) edge.",
  },
  infoCoeff: {
    title: "Information Coefficient (IC)",
    what: "Correlation between predicted and realized returns - the core metric quants use to grade a signal.",
    formula: "corr(prediction, realized return)",
    interpretation: "0.03-0.06 is a usable signal; 0.1+ is excellent for daily equity returns.",
  },
  rSquared: {
    title: "R-squared",
    what: "Fraction of return variance the model explains out-of-sample.",
    interpretation: "Near 0 (even slightly negative) is normal for daily returns - they are mostly noise.",
  },
  monteCarloResample: {
    title: "Monte Carlo Resampling",
    what: "Bootstraps the strategy's daily returns thousands of times to build a distribution of possible equity paths.",
    points: [
      "The shaded band spans the 5th-95th percentile of resampled equity.",
      "Probability of profit = share of resampled paths ending above the starting capital.",
    ],
    interpretation: "Judges a strategy by its distribution of outcomes, not a single backtest that might be luck.",
  },
  featureImportance: {
    title: "Feature Importance",
    what: "How much each feature reduced prediction error across the forest - which inputs the model leaned on.",
    interpretation: "Concentration in a few features can signal a real driver; perfectly even importance suggests noise.",
  },
};

export default GLOSSARY;
