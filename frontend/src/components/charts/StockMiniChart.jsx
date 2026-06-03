import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

/**
 * StockMiniChart — lightweight sparkline of a price series.
 *
 * Pure presentational component: pass `data` as an array of
 * `{ time, price }` points. Kept dependency-free (no data fetching) so it can
 * be dropped into any card; the parent owns the data source.
 */
export default function StockMiniChart({ symbol, data = [] }) {
  const points = Array.isArray(data) ? data : [];

  return (
    <div className="card card-pad">
      <div className="mb-2 text-sm text-gray-400">{symbol} Price</div>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={points} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <XAxis dataKey="time" hide />
          <YAxis hide domain={["auto", "auto"]} />
          <Tooltip
            contentStyle={{
              backgroundColor: "#0b1120",
              border: "1px solid #334155",
              borderRadius: "8px",
              color: "#e2e8f0",
            }}
          />
          <Line
            type="monotone"
            dataKey="price"
            stroke="#34d399"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
