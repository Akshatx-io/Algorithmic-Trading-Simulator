// import { useEffect, useState } from "react";
// import { getPerformance } from "../../services/performanceService";

// import {
//   LineChart,
//   Line,
//   XAxis,
//   YAxis,
//   Tooltip,
//   ResponsiveContainer,
// } from "recharts";

// const EquityChart = () => {
//   const [data, setData] = useState([]);

//   useEffect(() => {
//     let interval;

//     const fetchData = async () => {
//       try {
//         const res = await getPerformance();
//         if (res?.status === "success") {
//           setData(res.equity_curve || []);
//         }
//       } catch {}
//     };

//     fetchData();
//     interval = setInterval(fetchData, 5000); // ✅ live refresh

//     return () => clearInterval(interval);
//   }, []);

//   return (
//     <div className="bg-gray-900 p-4 rounded-xl">
//       <ResponsiveContainer width="100%" height={300}>
//         <LineChart data={data}>
//           <XAxis dataKey="time" />
//           <YAxis />
//           <Tooltip />
//           <Line dataKey="equity" strokeWidth={2} dot={false} />
//         </LineChart>
//       </ResponsiveContainer>
//     </div>
//   );
// };

// export default EquityChart;












import { useEffect, useState, useRef } from "react";
import { getPerformance } from "../../services/performanceService";

export default function EquityChart() {
  const [data, setData] = useState([]);
  const intervalRef = useRef(null);

  const fetchData = async () => {
    try {
      const res = await getPerformance();

      if (res?.status === "success") {
        setData(res.equity_curve || []);
      }

    } catch (err) {
      console.error("Performance fetch error:", err);
    }
  };

  useEffect(() => {
    fetchData();

    // 🔥 POLL SAFELY
    intervalRef.current = setInterval(fetchData, 5000);

    return () => clearInterval(intervalRef.current);
  }, []);

  // ===============================
  // EMPTY STATE
  // ===============================
  if (!data.length) {
    return (
      <div className="text-gray-400 text-center mt-10">
        No performance data yet
      </div>
    );
  }

  return (
    <div>
      {/* your chart rendering */}
      <pre className="text-white">{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}