import apiClient from "./apiClient";

/** Run a strategy backtest. params: { symbol, strategy, fast, slow, rsi_period, rsi_buy, rsi_sell, cost_bps, years, initial }. */
export const getBacktest = async (params) => {
  const res = await apiClient.get("/backtest", { params });
  return res.data;
};
