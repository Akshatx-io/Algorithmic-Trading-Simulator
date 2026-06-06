import apiClient from "./apiClient";

/**
 * Monte-Carlo price a European option.
 * params: { s, k, t, r, sigma, kind, n }
 * Returns { status, mc, black_scholes, greeks, prob_itm, paths, histogram, time_axis, strike }.
 */
export const priceOption = async (params) => {
  const res = await apiClient.get("/options/montecarlo", { params });
  return res.data;
};
