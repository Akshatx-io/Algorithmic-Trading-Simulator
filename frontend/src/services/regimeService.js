import apiClient from "./apiClient";

/**
 * Fetch market-regime analysis for a symbol.
 * Returns { symbol, interval, status, points:[{time, close, regime}], summary }.
 */
export const getRegime = async (symbol, interval = "1d") => {
  const res = await apiClient.get(`/regime/${symbol}`, { params: { interval } });
  return res.data;
};
