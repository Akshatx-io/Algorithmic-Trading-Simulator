import apiClient from "./apiClient";

/**
 * Run the Monte-Carlo portfolio optimization for a basket of symbols.
 * Returns { status, symbols, n_portfolios, risk_free, frontier, max_sharpe, min_vol }.
 */
export const getOptimization = async (symbols, n = 6000) => {
  const res = await apiClient.get("/optimizer", {
    params: { symbols: (symbols || []).join(","), n },
  });
  return res.data;
};
