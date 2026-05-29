import { useEffect, useState } from "react"
import { connectWebSocket } from "../../services/websocket"

export default function TradeFeed(){

  const [trades,setTrades] = useState([])

  useEffect(()=>{

    connectWebSocket((data)=>{

      if(data.type === "trade"){

        setTrades(prev => [data.data, ...prev])

      }

    })

  },[])

  return(

    <div>

      <h3>Trade Feed</h3>

      <table>

        <thead>
          <tr>
            <th>Symbol</th>
            <th>Side</th>
            <th>Price</th>
            <th>Qty</th>
          </tr>
        </thead>

        <tbody>

          {trades.map((trade,index)=>(

            <tr key={index}>
              <td>{trade.symbol}</td>
              <td>{trade.side}</td>
              <td>{trade.price}</td>
              <td>{trade.qty}</td>
            </tr>

          ))}

        </tbody>

      </table>

    </div>

  )

}