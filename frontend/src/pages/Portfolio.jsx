// import { useState, useEffect } from "react";
// import { useNavigate } from "react-router-dom";

// import usePortfolio from "../hooks/usePortfolio";
// import useMarket from "../hooks/useMarket";

// import AllocationPie from "../components/charts/AllocationPie";
// import PositionsTable from "../components/trading/PositionsTable";
// import StockDetailsPanel from "../components/trading/StockDetailsPanel";
// import LoadingSpinner from "../components/common/LoadingSpinner";
// import ErrorMessage from "../components/common/ErrorMessage";

// const Portfolio = () => {
//   const navigate = useNavigate();
//   const portfolio = usePortfolio();
//   const market = useMarket();

//   const [selectedPosition, setSelectedPosition] = useState(null);
//   const [refreshing, setRefreshing] = useState(false);

//   // Extract positions from portfolio data
//   const positions = portfolio?.portfolio?.positions || [];

//   // 🔥 Merge live market data with portfolio positions
//   const mergedPositions = positions.map((pos) => {
//     const live = market.find((m) => m.symbol === pos.symbol);

//     // Use live price if available, otherwise fallback to position data
//     const currentPrice = live?.price ?? pos.current_price ?? pos.avg_price ?? 0;
//     const marketValue = pos.quantity * currentPrice;
//     const pnl = (currentPrice - pos.avg_price) * pos.quantity;
//     const pnlPercentage = pos.avg_price > 0 ? ((currentPrice - pos.avg_price) / pos.avg_price) * 100 : 0;

//     return {
//       ...pos,
//       current_price: currentPrice,
//       market_value: marketValue,
//       pnl: pnl,
//       pnl_percentage: pnlPercentage,
//       // ✅ USE BACKEND SIGNAL if available, otherwise default to HOLD
//       signal: pos.signal ?? "HOLD",
//       // Add live data indicators
//       is_live: live !== undefined,
//       last_update: live?.timestamp || pos.updated_at
//     };
//   });

//   // Auto-select first position when data loads
//   useEffect(() => {
//     if (!selectedPosition && mergedPositions.length > 0) {
//       setSelectedPosition(mergedPositions[0]);
//     }
//   }, [mergedPositions, selectedPosition]);

//   // Handle manual refresh
//   const handleRefresh = async () => {
//     setRefreshing(true);
//     try {
//       await portfolio.refresh();
//     } catch (error) {
//       console.error("Refresh failed:", error);
//     } finally {
//       setRefreshing(false);
//     }
//   };

//   // Handle position selection
//   const handlePositionSelect = (position) => {
//     setSelectedPosition(position);
//   };

//   // Loading state
//   if (portfolio.loading && !portfolio.portfolio) {
//     return (
//       <div className="flex items-center justify-center min-h-[400px]">
//         <LoadingSpinner />
//       </div>
//     );
//   }

//   // Error state
//   if (portfolio.error) {
//     return (
//       <div className="p-6">
//         <ErrorMessage
//           message={`Failed to load portfolio: ${portfolio.error}`}
//           onRetry={handleRefresh}
//         />
//       </div>
//     );
//   }

//   // Empty portfolio state
//   if (!portfolio.portfolio || positions.length === 0) {
//     return (
//       <div className="p-6">
//         <div className="bg-gray-900 rounded-xl p-8 text-center">
//           <h3 className="text-xl font-semibold text-white mb-4">
//             No Positions Yet
//           </h3>
//           <p className="text-gray-400 mb-6">
//             Start trading to build your portfolio. Your positions and performance will appear here.
//           </p>
//           <button
//             onClick={() => navigate('/trade')}
//             className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
//           >
//             Start Trading
//           </button>
//         </div>
//       </div>
//     );
//   }

//   const totalEquity = portfolio.portfolio.total_equity || 0;
//   const totalPnl = portfolio.portfolio.total_pnl || 0;
//   const pnlPercentage = portfolio.portfolio.pnl_percentage || 0;

//   return (
//     <div className="p-6 space-y-6">

//       {/* Header with Portfolio Summary */}
//       <div className="bg-gray-900 rounded-xl p-6">
//         <div className="flex justify-between items-start mb-4">
//           <h1 className="text-2xl font-bold text-white">Portfolio</h1>
//           <button
//             onClick={handleRefresh}
//             disabled={refreshing}
//             className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
//           >
//             {refreshing ? "Refreshing..." : "Refresh"}
//           </button>
//         </div>

//         {/* Key Metrics */}
//         <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
//           <div className="bg-gray-800 p-4 rounded-lg">
//             <p className="text-gray-400 text-sm">Total Equity</p>
//             <p className="text-2xl font-semibold text-white">
//               ${totalEquity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
//             </p>
//           </div>

//           <div className="bg-gray-800 p-4 rounded-lg">
//             <p className="text-gray-400 text-sm">Total P&L</p>
//             <p className={`text-2xl font-semibold ${totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
//               ${totalPnl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
//             </p>
//           </div>

//           <div className="bg-gray-800 p-4 rounded-lg">
//             <p className="text-gray-400 text-sm">P&L %</p>
//             <p className={`text-2xl font-semibold ${pnlPercentage >= 0 ? 'text-green-400' : 'text-red-400'}`}>
//               {pnlPercentage >= 0 ? '+' : ''}{pnlPercentage.toFixed(2)}%
//             </p>
//           </div>
//         </div>
//       </div>

//       {/* Main Content */}
//       <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

//         {/* Left Side - Charts and Table */}
//         <div className="lg:col-span-2 space-y-6">

//           {/* Allocation Pie Chart */}
//           <div className="bg-gray-900 rounded-xl p-6">
//             <h3 className="text-lg font-semibold text-white mb-4">Asset Allocation</h3>
//             <AllocationPie
//               positions={mergedPositions}
//               onSelect={handlePositionSelect}
//             />
//           </div>

//           {/* Positions Table */}
//           <div className="bg-gray-900 rounded-xl p-6">
//             <h3 className="text-lg font-semibold text-white mb-4">Positions</h3>
//             <PositionsTable
//               positions={mergedPositions}
//               onSelect={handlePositionSelect}
//               selectedPosition={selectedPosition}
//             />
//           </div>

//         </div>

//         {/* Right Side - Stock Details */}
//         <div className="lg:col-span-1">
//           <StockDetailsPanel position={selectedPosition} />
//         </div>

//       </div>

//     </div>
//   );
// };

// export default Portfolio;












import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";

import usePortfolio from "../hooks/usePortfolio";
import useMarket from "../hooks/useMarket";

import AllocationPie from "../components/charts/AllocationPie";
import PositionsTable from "../components/trading/PositionsTable";
import StockDetailsPanel from "../components/trading/StockDetailsPanel";
import LoadingSpinner from "../components/common/LoadingSpinner";
import ErrorMessage from "../components/common/ErrorMessage";
import apiClient from "../services/apiClient";
import { resetAccount } from "../services/portfolioService";

const Portfolio = () => {
  const navigate = useNavigate();
  const portfolio = usePortfolio();
  const market = useMarket();

  const [selectedSymbol, setSelectedSymbol] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [marketSnapshot, setMarketSnapshot] = useState({});
  const [signalSnapshot, setSignalSnapshot] = useState({});

  const positions = portfolio?.portfolio?.positions || [];

  const safeNum = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  // Pull authoritative quotes and signal confidence snapshots to avoid stale/flickering table values.
  useEffect(() => {
    if (!positions.length) return;
    let mounted = true;
    const symbols = [...new Set(positions.map((p) => p.symbol).filter(Boolean))];

    const refreshSnapshots = async () => {
      try {
        const [marketResults, signalRes] = await Promise.all([
          Promise.all(
            symbols.map((s) =>
              apiClient.get(`/market/${s}`).then((r) => r.data).catch(() => null)
            )
          ),
          apiClient.get("/signals").then((r) => r.data).catch(() => null),
        ]);

        if (!mounted) return;

        const nextMarket = {};
        marketResults.forEach((row) => {
          if (!row?.symbol) return;
          nextMarket[row.symbol] = safeNum(row.price);
        });
        setMarketSnapshot(nextMarket);

        const nextSignals = {};
        (signalRes?.signals || []).forEach((sig) => {
          if (!sig?.symbol) return;
          nextSignals[sig.symbol] = {
            signal: sig.signal || "HOLD",
            confidence: safeNum(sig.confidence),
          };
        });
        setSignalSnapshot(nextSignals);
      } catch {
        // Keep last stable snapshots on transient failures.
      }
    };

    refreshSnapshots();
    const id = setInterval(refreshSnapshots, 5000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, [positions]);

  // ✅ O(1) lookup map
  const marketMap = useMemo(() => {
    const map = {};
    market.forEach((m) => {
      map[m.symbol] = m;
    });
    return map;
  }, [market]);

  // ✅ MEMOIZED MERGE (NO RECOMPUTE)
  const mergedPositions = useMemo(() => {
    return positions.map((pos) => {
      const live = marketMap[pos.symbol];

      const quantity = safeNum(pos.quantity);
      const avgPrice = safeNum(pos.avg_price);
      // Deterministic price source: authoritative API snapshot first; avoid raw WS flicker.
      const price = safeNum(
        marketSnapshot[pos.symbol] ?? pos.current_price ?? pos.avg_price
      );
      const signalInfo = signalSnapshot[pos.symbol];
      const rawSignal = live?.signal ?? signalInfo?.signal ?? pos.signal ?? "HOLD";
      const confidence = safeNum(signalInfo?.confidence);
      const heuristicSignal =
        ((price - avgPrice) / Math.max(avgPrice, 1e-9)) * 100 > 0.3
          ? "BUY"
          : ((price - avgPrice) / Math.max(avgPrice, 1e-9)) * 100 < -0.3
          ? "SELL"
          : "HOLD";
      const signal =
        rawSignal && rawSignal !== "HOLD"
          ? rawSignal
          : confidence > 0
          ? rawSignal
          : heuristicSignal;

      return {
        ...pos,
        quantity,
        avg_price: avgPrice,
        current_price: price,
        market_value: quantity * price,
        pnl: (price - avgPrice) * quantity,
        pnl_percentage:
          avgPrice > 0
            ? ((price - avgPrice) / avgPrice) * 100
            : 0,
        signal,
        signal_confidence: confidence,
        candles: Array.isArray(live?.candles) ? live.candles : [],
        is_live: !!live,
      };
    });
  }, [positions, marketMap, marketSnapshot, signalSnapshot]);

  // ✅ stable selection
  useEffect(() => {
    if (!selectedSymbol && mergedPositions.length > 0) {
      setSelectedSymbol(mergedPositions[0].symbol);
    }
  }, [mergedPositions, selectedSymbol]);

  const selectedPosition = useMemo(() => {
    if (!mergedPositions.length) return null;
    return (
      mergedPositions.find((p) => p.symbol === selectedSymbol) || mergedPositions[0]
    );
  }, [mergedPositions, selectedSymbol]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await portfolio.refresh().catch(() => {});
    setRefreshing(false);
  };

  const handleReset = async () => {
    const ok = window.confirm(
      "Reset account? This permanently clears all positions, trades, and history, and restores your starting balance."
    );
    if (!ok) return;
    setRefreshing(true);
    try {
      await resetAccount();
      setSelectedSymbol(null);
      await portfolio.refresh().catch(() => {});
    } finally {
      setRefreshing(false);
    }
  };

  const totals = useMemo(() => {
    const p = portfolio.portfolio || {};
    const marketValue = mergedPositions.reduce((acc, pos) => acc + safeNum(pos.market_value), 0);
    const unrealized = mergedPositions.reduce((acc, pos) => acc + safeNum(pos.pnl), 0);
    const realized = safeNum(p.realized_pnl);
    const totalPnl = safeNum(p.total_pnl || unrealized + realized);
    const equity = safeNum(p.total_equity || marketValue);
    const pct =
      equity > 0
        ? (totalPnl / Math.max(equity - totalPnl, 1e-9)) * 100
        : 0;
    return { equity, totalPnl, pct };
  }, [portfolio.portfolio, mergedPositions]);

  if (portfolio.loading && !portfolio.portfolio) {
    return <LoadingSpinner />;
  }

  if (portfolio.error) {
    return <ErrorMessage message={portfolio.error} onRetry={handleRefresh} />;
  }

  if (!positions.length) {
    return (
      <div className="p-6 text-center">
        <button onClick={() => navigate("/trade")}>
          Start Trading
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-full">

      {/* SUMMARY METRICS */}
      <div className="bg-gray-900 p-6 rounded-xl border border-gray-800">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Account Summary</h2>
          <button
            onClick={handleReset}
            disabled={refreshing}
            className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-sm text-red-300 transition hover:bg-red-500/20 disabled:opacity-50"
          >
            {refreshing ? "Working..." : "Reset Account"}
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Metric label="Equity" value={totals.equity} />
          <Metric label="P&L" value={totals.totalPnl} />
          <Metric label="Return %" value={totals.pct} isPercent />
        </div>
      </div>

      {/* CONTENT */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">

        <div className="xl:col-span-2 space-y-6 min-w-0">
          <AllocationPie
            positions={mergedPositions}
            onSelect={(pos) => setSelectedSymbol(pos?.symbol || null)}
          />
          <PositionsTable
            positions={mergedPositions}
            onSelect={(pos) => setSelectedSymbol(pos?.symbol || null)}
            selectedPosition={selectedPosition}
          />
        </div>

        <div className="min-w-0">
          <StockDetailsPanel position={selectedPosition} />
        </div>

      </div>
    </div>
  );
};

// 🔥 reusable metric component
const Metric = ({ label, value, isPercent }) => {
  const formatted = isPercent
    ? `${value.toFixed(2)}%`
    : `$${value.toLocaleString()}`;

  const color =
    value >= 0 ? "text-green-400" : "text-red-400";

  return (
    <div className="bg-gray-800 p-4 rounded">
      <p className="text-gray-400">{label}</p>
      <p className={`${color} text-xl`}>{formatted}</p>
    </div>
  );
};

export default Portfolio;