import { useEffect, useState } from "react"
import axios from "axios"

export default function RiskMonitor(){

  const [risk,setRisk] = useState({})

  useEffect(()=>{

    const fetchRisk = async () => {

      const res = await axios.get("http://localhost:8000/risk")

      setRisk(res.data)

    }

    fetchRisk()

  },[])

  return(

    <div>

      <h3>Risk Monitor</h3>

      <p>Portfolio Value: {risk.portfolio_value}</p>

      <p>Daily PnL: {risk.daily_pnl}</p>

      <p>Max Drawdown: {risk.max_drawdown}</p>

      <p>Exposure: {risk.exposure}</p>

    </div>

  )

}