// import { useState } from "react";
// import { executeTrade } from "../../services/tradeService";
// import ErrorMessage from "../common/ErrorMessage";
// import LoadingSpinner from "../common/LoadingSpinner";
// import SymbolSearch from "./SymbolSearch";

// const TradingPanel = () => {
//   const [symbol, setSymbol] = useState("AAPL");
//   const [quantity, setQuantity] = useState(1);
//   const [orderType, setOrderType] = useState("MARKET");
//   const [limitPrice, setLimitPrice] = useState("");

//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState(null);
//   const [tradeResult, setTradeResult] = useState(null);

//   // ===============================
//   // HANDLE TRADE
//   // ===============================
//   const handleTrade = async (action) => {
//     if (loading) return;

//     setLoading(true);
//     setError(null);
//     setTradeResult(null);

//     try {
//       const payload = {
//         symbol,
//         action,
//         quantity: Number(quantity),
//         order_type: orderType,
//         limit_price: orderType === "LIMIT" ? Number(limitPrice) : null,
//       };

//       const res = await executeTrade(payload);

//       // ✅ handle both axios + raw
//       const data = res?.data || res;

//       if (!data) {
//         throw new Error("Invalid API response");
//       }

//       if (data.status === "error") {
//         setError(data.message || "Trade failed");
//         return;
//       }

//       setTradeResult(data);

//     } catch (err) {
//       console.error("Trade Error:", err);

//       setError(
//         err?.message ||
//         err?.data?.message ||
//         err?.response?.data?.message ||
//         "Trade execution failed"
//       );

//     } finally {
//       setLoading(false);
//     }
//   };

//   // ===============================
//   // FORMATTERS (PRODUCTION SAFE)
//   // ===============================
//   const formatMoney = (val) => {
//     if (val === undefined || val === null) return "--";
//     return Number(val).toFixed(2);
//   };

//   // ===============================
//   // UI
//   // ===============================
//   return (
//     <div className="bg-gray-900 p-6 rounded-xl shadow-md w-full max-w-md">

//       <h2 className="text-xl font-semibold mb-4 text-white">
//         Trading Panel
//       </h2>

//       {/* ERROR */}
//       {error && <ErrorMessage message={error} />}

//       {/* ===============================
//           TRADE RESULT (FIXED HERE)
//       =============================== */}
//       {tradeResult && (
//         <div className="bg-green-900 border border-green-500 p-4 rounded mb-4">

//           <p className="text-green-300 font-semibold mb-2">
//             ✔ Trade Executed
//           </p>

//           <p>Action: {tradeResult.action ?? "--"}</p>
//           <p>Symbol: {tradeResult.symbol ?? "--"}</p>
//           <p>Quantity: {tradeResult.quantity ?? "--"}</p>

//           <p>
//             Price: $
//             {tradeResult.price !== undefined
//               ? formatMoney(tradeResult.price)
//               : "--"}
//           </p>

//           <p>
//             Total Value: $
//             {formatMoney(tradeResult.total_value)}
//           </p>

//           <p>
//             Balance: $
//             {formatMoney(tradeResult.balance)}
//           </p>

//         </div>
//       )}

//       {/* SYMBOL */}
//       <div className="mb-3">
//         <label className="block text-sm text-gray-300 mb-1">
//           Symbol
//         </label>

//         <SymbolSearch value={symbol} onChange={setSymbol} />
//       </div>

//       {/* QUANTITY */}
//       <div className="mb-3">
//         <label className="block text-sm text-gray-300 mb-1">
//           Quantity
//         </label>

//         <input
//           type="number"
//           min="1"
//           step="1"
//           value={quantity}
//           onChange={(e) => {
//             const val = Math.max(1, parseInt(e.target.value) || 1);
//             setQuantity(val);
//           }}
//           className="w-full p-2 rounded bg-gray-800 text-white"
//         />
//       </div>

//       {/* ORDER TYPE */}
//       <div className="mb-3">
//         <label className="block text-sm text-gray-300 mb-1">
//           Order Type
//         </label>

//         <select
//           value={orderType}
//           onChange={(e) => setOrderType(e.target.value)}
//           className="w-full p-2 rounded bg-gray-800 text-white"
//         >
//           <option value="MARKET">Market</option>
//           <option value="LIMIT">Limit</option>
//         </select>
//       </div>

//       {/* LIMIT PRICE */}
//       {orderType === "LIMIT" && (
//         <div className="mb-3">
//           <label className="block text-sm text-gray-300 mb-1">
//             Limit Price
//           </label>

//           <input
//             type="number"
//             value={limitPrice}
//             onChange={(e) => setLimitPrice(e.target.value)}
//             className="w-full p-2 rounded bg-gray-800 text-white"
//           />
//         </div>
//       )}

//       {loading && <LoadingSpinner />}

//       {/* ACTION BUTTONS */}
//       <div className="flex gap-4 mt-4">

//         <button
//           onClick={() => handleTrade("BUY")}
//           className="px-3 py-1 bg-green-600 rounded hover:bg-green-700"
//         >
//           BUY
//         </button>

//         <button
//           onClick={() => handleTrade("SELL")}
//           className="px-3 py-1 bg-red-600 rounded hover:bg-red-700"
//         >
//           SELL
//         </button>

//       </div>

//     </div>
//   );
// };

// export default TradingPanel;














import { useState } from "react";
import { executeTrade } from "../../services/tradeService";
import ErrorMessage from "../common/ErrorMessage";
import LoadingSpinner from "../common/LoadingSpinner";
import SymbolSearch from "./SymbolSearch";

const TradingPanel = () => {

  const [symbol, setSymbol] = useState("AAPL");
  const [quantity, setQuantity] = useState(1);
  const [orderType, setOrderType] = useState("MARKET");
  const [limitPrice, setLimitPrice] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // ===============================
  // VALIDATION
  // ===============================
  const validate = () => {
    if (!symbol) return "Symbol required";
    if (quantity <= 0) return "Invalid quantity";

    if (orderType === "LIMIT") {
      if (!limitPrice || Number(limitPrice) <= 0) {
        return "Invalid limit price";
      }
    }

    return null;
  };

  // ===============================
  // EXECUTE TRADE
  // ===============================
  const handleTrade = async (action) => {

    if (loading) return;

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const payload = {
        symbol,
        action,
        quantity: Number(quantity),
        order_type: orderType,
        limit_price:
          orderType === "LIMIT" ? Number(limitPrice) : null,
      };

      const res = await executeTrade(payload);
      const data = res?.data || res;

      if (!data || !data.success) {
        throw new Error(data?.message || "Trade failed");
      }

      // setSuccess(data);
      setSuccess({
        message: `Trade executed: ${data.symbol} ${data.action}`,
      });

      // RESET (important UX)
      setQuantity(1);
      setLimitPrice("");

    } catch (err) {
      setError(
        err?.message ||
        err?.response?.data?.message ||
        "Trade failed"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-900 p-6 rounded-xl w-full max-w-md">

      <h2 className="text-white text-xl mb-4">Trading Panel</h2>

      {error && <ErrorMessage message={error} />}

      {success && (
        <div className="bg-green-900 p-3 rounded mb-3">
          Trade Executed ✅
        </div>
      )}

      <SymbolSearch value={symbol} onChange={setSymbol} />

      <input
        type="number"
        value={quantity}
        min="1"
        onChange={(e) =>
          setQuantity(Math.max(1, Number(e.target.value)))
        }
        className="w-full p-2 mt-2 bg-gray-800 text-white rounded"
      />

      <select
        value={orderType}
        onChange={(e) => setOrderType(e.target.value)}
        className="w-full p-2 mt-2 bg-gray-800 text-white rounded"
      >
        <option value="MARKET">Market</option>
        <option value="LIMIT">Limit</option>
      </select>

      {orderType === "LIMIT" && (
        <input
          type="number"
          value={limitPrice}
          onChange={(e) => setLimitPrice(e.target.value)}
          className="w-full p-2 mt-2 bg-gray-800 text-white rounded"
        />
      )}

      {loading && <LoadingSpinner />}

      <div className="flex gap-4 mt-4">
        <button
          disabled={loading}
          onClick={() => handleTrade("BUY")}
          className="bg-green-600 px-4 py-2 rounded"
        >
          BUY
        </button>

        <button
          disabled={loading}
          onClick={() => handleTrade("SELL")}
          className="bg-red-600 px-4 py-2 rounded"
        >
          SELL
        </button>
      </div>
    </div>
  );
};

export default TradingPanel;