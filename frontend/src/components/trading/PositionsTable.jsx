// import { useEffect, useState } from "react";
// import { connectWebSocket, subscribePrices } from "../../services/websocket";

// const PositionsTable = ({ positions }) => {

//   const [prices, setPrices] = useState({});

//   useEffect(() => {

//     connectWebSocket();

//     const unsubscribe = subscribePrices((data) => {

//       setPrices(data);

//     });

//     return unsubscribe;

//   }, []);

//   if (!positions || positions.length === 0) {
//     return <div className="text-gray-400 mt-4">No open positions</div>;
//   }

//   return (

//     <div className="bg-gray-900 p-4 rounded-xl shadow mt-6">

//       <h3 className="text-white text-lg mb-4">Open Positions</h3>

//       <table className="w-full text-sm text-left">

//         <thead className="text-gray-400 border-b border-gray-700">

//           <tr>
//             <th className="py-2">Symbol</th>
//             <th>Quantity</th>
//             <th>Avg Price</th>
//             <th>Current Price</th>
//             <th>Market Value</th>
//             <th>PnL</th>
//           </tr>

//         </thead>

//         <tbody>

//           {positions.map((pos) => {

//             const livePrice =
//               prices[pos.symbol]?.price || pos.current_price;

//             const pnl = (livePrice - pos.avg_price) * pos.quantity;

//             return (

//               <tr key={pos.symbol} className="border-b border-gray-800">

//                 <td className="py-2 text-white">{pos.symbol}</td>

//                 <td>{pos.quantity}</td>

//                 <td>${pos.avg_price.toFixed(2)}</td>

//                 <td>${livePrice.toFixed(2)}</td>

//                 <td>${(livePrice * pos.quantity).toFixed(2)}</td>

//                 <td className={pnl >= 0 ? "text-green-400" : "text-red-400"}>
//                   {pnl.toFixed(2)}
//                 </td>

//               </tr>

//             );

//           })}

//         </tbody>

//       </table>

//     </div>

//   );

// };

// export default PositionsTable;



// import usePortfolio from "../../hooks/usePortfolio";
// import useMarket from "../../hooks/useMarket";

// export default function PositionsTable({ positions, onSelect }) {

//   const market = useMarket();

//   const positions = portfolio?.positions || [];

//   // Merge LIVE data
//   const mergedPositions = positions.map((pos) => {
//     const live = market.find((m) => m.symbol === pos.symbol);

//     return {
//       ...pos,
//       current_price: live?.price || pos.current_price,
//       signal: live?.signal || "HOLD",
//     };
//   });

//   return (
//     <div>
//       <h2>Open Positions</h2>

//       <table>
//         <thead>
//           <tr>
//             <th>Symbol</th>
//             <th>Qty</th>
//             <th>Avg Price</th>
//             <th>Live Price</th>
//             <th>PnL</th>
//             <th>Signal</th>
//           </tr>
//         </thead>

//         <tbody>
//           {mergedPositions.map((pos) => (
//             <tr key={pos.symbol}>
//               <td>{pos.symbol}</td>
//               <td>{pos.quantity}</td>
//               <td>{pos.avg_price}</td>
//               <td>{pos.current_price}</td>
//               <td>
//                 {(pos.current_price - pos.avg_price) * pos.quantity}
//               </td>
//               <td>{pos.signal}</td>
//             </tr>
//           ))}
//         </tbody>
//       </table>
//     </div>
//   );
// }


// export default function PositionsTable({ positions, onSelect }) {

//   if (!positions.length) {
//   return (
//     <div className="text-gray-400 p-4">
//       No positions yet. Start trading 🚀
//     </div>
//   );
//   }

//   return (
//     <div>
//       <h2>Open Positions</h2>

//       <table>
//         <thead>
//           <tr className="hover:bg-gray-800 transition-all duration-200 cursor-pointer">
//             <th>Symbol</th>
//             <th>Qty</th>
//             <th>Avg Price</th>
//             <th>Live Price</th>
//             <th>PnL</th>
//             <th>Signal</th>
//           </tr>
//         </thead>

//         <tbody>
//           {positions.map((pos) => (
//             <tr
//               key={pos.symbol}
//               onClick={() => onSelect(pos)}
//               style={{ cursor: "pointer" }}
//               className="hover:bg-gray-800 transition-all duration-200 cursor-pointer"
//             >
//               <td>{pos.symbol}</td>
//               <td>{pos.quantity}</td>
//               <td>{pos.avg_price}</td>
//               <td>{pos.current_price}</td>
//               <td className={ pos.current_price >= pos.avg_price ? "text-green-400" : "text-red-400"}>
//                 {(pos.current_price - pos.avg_price) * pos.quantity}
//               </td>
//               <td>{pos.signal}</td>
//             </tr>
//           ))}
//         </tbody>
//       </table>
//     </div>
//   );
// }






// import { formatCurrency } from "../../utils/formatCurrency";

// export default function PositionsTable({ positions, onSelect }) {

//   if (!positions.length) {
//     return (
//       <div className="text-gray-400 p-4">
//         No positions yet. Start trading 🚀
//       </div>
//     );
//   }

//   return (
//     <div className="bg-gray-900 p-4 rounded-xl border border-gray-800">

//       <h2 className="text-white text-lg mb-4">Open Positions</h2>

//       <table className="w-full text-sm text-left">

//         <thead className="text-gray-400 border-b border-gray-800">
//           <tr>
//             <th className="py-2">Symbol</th>
//             <th>Qty</th>
//             <th>Avg Price</th>
//             <th>Live Price</th>
//             <th>PnL</th>
//             <th>Signal</th>
//           </tr>
//         </thead>

//         <tbody>
//           {positions.map((pos) => {

//             const pnl =
//               (pos.current_price - pos.avg_price) * pos.quantity;

//             return (
//               <tr
//                 key={pos.symbol}
//                 onClick={() => onSelect(pos)}
//                 className="hover:bg-gray-800 transition-all duration-200 cursor-pointer border-b border-gray-800"
//               >

//                 <td className="py-2 text-white">{pos.symbol}</td>

//                 <td>{pos.quantity}</td>

//                 <td>{formatCurrency(pos.avg_price)}</td>

//                 <td>{formatCurrency(pos.current_price)}</td>

//                 <td className={pnl >= 0 ? "text-green-400" : "text-red-400"}>
//                   {formatCurrency(pnl)}
//                 </td>

//                 <td>{pos.signal}</td>

//               </tr>
//             );
//           })}
//         </tbody>

//       </table>

//     </div>
//   );
// }












import { useMemo } from "react";
import { formatCurrency } from "../../utils/formatCurrency";

export default function PositionsTable({
  positions = [],
  onSelect,
  selectedPosition,
}) {

  const sortedPositions = useMemo(() => {
    return [...positions].sort(
      (a, b) => b.market_value - a.market_value
    );
  }, [positions]);

  if (!sortedPositions.length) {
    return (
      <div className="text-gray-400 p-4">
        No positions yet. Start trading 🚀
      </div>
    );
  }

  return (
    <div className="bg-gray-900 p-4 rounded-xl border border-gray-800">

      <h2 className="text-white text-lg mb-4">Open Positions</h2>

      <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-sm text-left">

        <thead className="text-gray-400 border-b border-gray-800">
          <tr>
            <th className="py-2">Symbol</th>
            <th>Qty</th>
            <th>Avg</th>
            <th>Price</th>
            <th>Value</th>
            <th>PnL</th>
            <th>Signal</th>
          </tr>
        </thead>

        <tbody>
          {sortedPositions.map((pos) => {
            const pnl =
              (pos.current_price - pos.avg_price) * pos.quantity;

            const isSelected =
              selectedPosition?.symbol === pos.symbol;

            return (
              <tr
                key={pos.symbol}
                onClick={() => onSelect(pos)}
                className={`cursor-pointer border-b border-gray-800 transition
                  ${isSelected ? "bg-gray-800" : "hover:bg-gray-800"}`}
              >
                <td className="py-2 text-white">{pos.symbol}</td>

                <td>{pos.quantity}</td>

                <td>{formatCurrency(pos.avg_price)}</td>

                <td>{formatCurrency(pos.current_price)}</td>

                <td>{formatCurrency(pos.market_value)}</td>

                <td
                  className={
                    pnl >= 0 ? "text-green-400" : "text-red-400"
                  }
                >
                  {formatCurrency(pnl)}
                </td>

                <td>{pos.signal}</td>
              </tr>
            );
          })}
        </tbody>

      </table>
      </div>

    </div>
  );
}