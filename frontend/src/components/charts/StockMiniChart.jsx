import { useEffect, useState } from "react";
import axios from "../../api/axios";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer
} from "recharts";

const StockMiniChart = ({ symbol }) => {

  const [data, setData] = useState([]);
  const [currentPrice, setCurrentPrice] = useState(null);
  const [priceChange, setPriceChange] = useState(0);
  const [priceChangePct, setPriceChangePct] = useState(0);

  const fetchData = async () => {
    try {

      const res = await axios.get(`/stock-price/${symbol}`);

      setData((prev) => {
        const newData = [...prev, ...res.data];

        // keep only last 120 points
        return newData.slice(-120);
      });

      if (res.data.length > 1) {

        const latest = res.data[res.data.length - 1].price;
        const previous = res.data[res.data.length - 2].price;

        const change = latest - previous;
        const changePct = (change / previous) * 100;

        setCurrentPrice(latest);
        setPriceChange(change);
        setPriceChangePct(changePct);

      }

    } catch (err) {
      console.error("Chart data error", err);
    }
  };

  useEffect(() => {

    fetchData();

    const interval = setInterval(() => {
      fetchData();
    }, 5000);

    return () => clearInterval(interval);

  }, [symbol]);

  return (
    <div className="bg-gray-800 p-3 rounded transition-all duration-200">

      <div className="flex justify-between items-center mb-2">

        <div className="text-sm text-gray-400">
          {symbol} Price
        </div>

        {currentPrice && (

          <div className="flex items-center gap-2 font-semibold">

            <span>
              ${currentPrice.toFixed(2)}
            </span>

            <span
              className={
                priceChange >= 0
                ? "text-green-400"
                : "text-red-400"
              }
            >

              {priceChange >= 0 ? "▲" : "▼"}

              {Math.abs(priceChange).toFixed(2)}

              ({Math.abs(priceChangePct).toFixed(2)}%)

            </span>

          </div>

        )}

      </div>

      <ResponsiveContainer width="100%" height={160}>

        <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }} >

          <XAxis dataKey="time" hide />
          <YAxis hide />

          <Tooltip />

          <Line
            type="monotone"
            dataKey="price"
            stroke="#4ade80"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />

        </LineChart>

      </ResponsiveContainer>

    </div>
  );
};

export default StockMiniChart;