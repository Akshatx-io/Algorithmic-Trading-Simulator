import apiClient from "./apiClient";

/** Run the return predictor. params: { symbol, years, n_estimators, max_depth, cost_bps, mc_sims }. */
export const getPrediction = async (params) => {
  const res = await apiClient.get("/predict", { params });
  return res.data;
};
