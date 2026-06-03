import apiClient from "./apiClient";

export const getPortfolio = async () => {
  const res = await apiClient.get("/portfolio");
  const data = res.data || {};

  // Backend now returns flat keys (with `summary` kept for back-compat).
  const summary = data.summary || {};

  return {
    status: data.status || "success",
    positions: data.positions || [],
    total_equity: Number(data.total_equity ?? 0),
    cash_balance: Number(data.cash_balance ?? 0),
    market_value: Number(data.market_value ?? 0),
    total_pnl: Number(data.total_pnl ?? summary.total_pnl ?? 0),
    unrealized_pnl: Number(data.unrealized_pnl ?? summary.unrealized_pnl ?? 0),
    realized_pnl: Number(data.realized_pnl ?? summary.realized_pnl ?? 0),
    pnl_percentage: Number(data.pnl_percentage ?? 0),
  };
};

export const resetAccount = async () => {
  const res = await apiClient.post("/account/reset");
  return res.data;
};
