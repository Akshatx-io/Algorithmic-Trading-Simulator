import { useEffect, useState, useCallback } from "react";
import { getPortfolio } from "../services/portfolioService";
import { subscribeTradeUpdates } from "../services/tradeService";


//===============================
// ELITE PORTFOLIO HOOK
//===============================

const usePortfolio = () => {
  const [portfolio, setPortfolio] = useState({
    positions: [],          // 🔥 SAFE DEFAULT
    total_equity: 0,
    total_pnl: 0,
    unrealized_pnl: 0,
    realized_pnl: 0,
    pnl_percentage: 0,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);


  //===============================
  // FETCH FUNCTION (MEMOIZED)
  //===============================
  const fetchPortfolio = useCallback(async () => {
    try {
      setLoading(true);

      const res = await getPortfolio();

      if (!res || res.status !== "success") {
        throw new Error("Invalid portfolio response");
      }

      // Normalized flat structure (matches portfolioService output).
      setPortfolio({
        positions: res.positions || [],
        total_equity: res.total_equity || 0,
        cash_balance: res.cash_balance || 0,
        market_value: res.market_value || 0,
        total_pnl: res.total_pnl || 0,
        unrealized_pnl: res.unrealized_pnl || 0,
        realized_pnl: res.realized_pnl || 0,
        pnl_percentage: res.pnl_percentage || 0,
      });

      setError(null);

    } catch (err) {
      setError(err.message || "Failed to fetch portfolio");
    } finally {
      setLoading(false);
    }
  }, []);



  //===============================
  //   INITIAL LOAD
  //===============================
  useEffect(() => {
    fetchPortfolio();

    const unsubscribe = subscribeTradeUpdates(fetchPortfolio);
    return () => unsubscribe();
  }, [fetchPortfolio]);

  return {
    portfolio,
    loading,
    error,
    refresh: fetchPortfolio,
  };
};

export default usePortfolio;