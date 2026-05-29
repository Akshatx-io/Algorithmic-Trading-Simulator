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

      // 🔥 NORMALIZED STRUCTURE (CRITICAL)
      setPortfolio({
        positions: res.positions || [],
        total_equity: res.total_equity || 0,
        total_pnl: res.summary?.total_pnl || 0,
        unrealized_pnl: res.summary?.unrealized_pnl || 0,
        realized_pnl: res.summary?.realized_pnl || 0,
        pnl_percentage:
          res.total_equity > 0
            ? (res.summary?.total_pnl || 0) / res.total_equity
            : 0,
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