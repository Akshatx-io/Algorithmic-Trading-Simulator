// // import { useEffect, useState } from "react";
// // import { connectWebSocket, subscribePrices } from "../../services/websocket";

// // const PriceTicker = () => {

// //   const [prices, setPrices] = useState({});

// //   useEffect(() => {

// //     connectWebSocket();

// //     const unsubscribe = subscribePrices((data) => {

// //       setPrices(data);

// //     });

// //     return unsubscribe;

// //   }, []);

// //   return (

// //     <div className="flex gap-6 text-sm">

// //       {Object.values(prices).map((stock) => (

// //         <div key={stock.symbol}
// //           className={stock.change >= 0 ? "text-green-400" : "text-red-400"}>

// //           {stock.symbol} ${stock.price}

// //         </div>

// //       ))}

// //     </div>

// //   );

// // };

// // export default PriceTicker;






// import useMarket from "../../hooks/useMarket";

// const PriceTicker = () => {

//   const market = useMarket();

//   return (
//     <div className="flex gap-6 overflow-x-auto bg-gray-900 p-2 text-sm">

//       {market.map((item) => {

//         const changeColor =
//           item.change >= 0 ? "text-green-400" : "text-red-400";

//         return (
//           <div key={item.symbol} className="flex gap-2">

//             <span className="font-semibold">{item.symbol}</span>

//             <span>${item.price}</span>

//             <span className={changeColor}>
//               {item.change >= 0 ? "+" : ""}
//               {item.change?.toFixed(2)}
//             </span>

//           </div>
//         );
//       })}

//     </div>
//   );
// };

// export default PriceTicker;


import useMarket from "../../hooks/useMarket";
import { formatCurrency } from "../../utils/formatCurrency";

const PriceTicker = () => {

  const market = useMarket();

  return (
    <div className="flex gap-6 overflow-x-auto bg-gray-900 p-2 text-sm border-b border-gray-800">

      {market.map((item) => {

        const changeColor =
          item.change >= 0 ? "text-green-400" : "text-red-400";

        return (
          <div key={item.symbol} className="flex gap-2 items-center">

            <span className="font-semibold text-white">
              {item.symbol}
            </span>

            <span>{formatCurrency(item.price)}</span>

            <span className={changeColor}>
              {item.change >= 0 ? "+" : ""}
              {item.change?.toFixed(2)}
            </span>

          </div>
        );
      })}

    </div>
  );
};

export default PriceTicker;