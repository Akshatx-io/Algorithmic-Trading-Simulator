import apiClient from "./apiClient";

export const getPortfolio = async () => {
  const res = await apiClient.get("/portfolio");

  // 🔥 NORMALIZE BACKEND RESPONSE
  const data = res.data;

  return {
    status: "success",
    positions: data.positions || [],
    total_equity: data.total_equity || 0,
    summary: {
      total_pnl: data.total_pnl || 0,
      unrealized_pnl: data.unrealized_pnl || 0,
      realized_pnl: data.realized_pnl || 0,
    },
  };
};