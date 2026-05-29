import { useEffect, useState } from "react";
import { connectWebSocket, subscribePrices } from "../services/websocket";

export default function Market() {

  const [prices,setPrices] = useState({});

  useEffect(()=>{

    connectWebSocket();

    const unsub = subscribePrices(data=>{
      setPrices(data);
    });

    return unsub;

  },[]);

  return (

    <div className="p-4">

      <table className="w-full text-sm">

        <thead>
          <tr>
            <th>Symbol</th>
            <th>Price</th>
            <th>Change</th>
          </tr>
        </thead>

        <tbody>

        {Object.values(prices).map(stock=>(
          <tr key={stock.symbol}>
            <td>{stock.symbol}</td>
            <td>{stock.price}</td>
            <td>{stock.change}</td>
          </tr>
        ))}

        </tbody>

      </table>

    </div>
  );
}