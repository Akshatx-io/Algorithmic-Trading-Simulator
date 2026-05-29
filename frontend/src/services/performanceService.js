import apiClient from "./apiClient";

export const getPerformance = async () => {
  const res = await apiClient.get("/performance");

  return {
    metrics: res.data.metrics || {},
    equityCurve: res.data.equity_curve || [],
  };
};