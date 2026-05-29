import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useMemo } from "react";

const COLORS = [
  "#4ade80",
  "#60a5fa",
  "#f472b6",
  "#facc15",
  "#34d399",
  "#a78bfa",
  "#fb923c",
  "#22d3ee"
];

const AllocationPie = ({ positions, onSelect }) => {

  if (!positions || positions.length === 0) {
    return (
      <div className="bg-gray-900 p-6 rounded-xl text-gray-400">
        No positions to display
      </div>
    );
  }

  const parseNumber = (v) => {
    if (typeof v === "number") return Number.isFinite(v) ? v : 0;
    if (typeof v === "string") {
      const cleaned = v.replace(/[^0-9.-]/g, "");
      const n = Number(cleaned);
      return Number.isFinite(n) ? n : 0;
    }
    return 0;
  };

  const data = useMemo(
    () =>
      positions
        .map((pos) => {
          const quantity = parseNumber(pos.quantity);
          const price = parseNumber(pos.current_price ?? pos.avg_price);
          const value = parseNumber(pos.market_value) || quantity * price;
          return {
            name: pos.symbol,
            value: Number.isFinite(value) && value > 0 ? value : 0,
            position: pos,
          };
        })
        .filter((d) => d.value > 0),
    [positions]
  );

  if (data.length === 0) {
    return (
      <div className="bg-gray-800 p-4 rounded-xl text-gray-400 min-h-[320px] flex items-center justify-center">
        Allocation chart will appear once positions have valid market values.
      </div>
    );
  }

  return (
    <div className="bg-gray-800 p-3 rounded transition-all duration-200 min-h-[320px]">

      <h3 className="text-white text-lg mb-4">
        Portfolio Allocation
      </h3>

      <ResponsiveContainer width="100%" height={300}>

        <PieChart>

          <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={0}
              outerRadius="70%"
              startAngle={90}
              endAngle={-270}
              paddingAngle={2}
              minAngle={4}
              dataKey="value"
              nameKey="name"
              onClick={(entry) => onSelect?.(entry?.position ?? entry?.payload?.position)}
          >

            {data.map((entry, index) => (
              <Cell
                key={index}
                fill={COLORS[index % COLORS.length]}
              />
            ))}

          </Pie>

          <Tooltip
            contentStyle={{
              backgroundColor: "#111827",
              border: "none",
              borderRadius: "8px"
            }}
          />

          <Legend
            layout="horizontal"
            align="center"
            verticalAlign="bottom"
            wrapperStyle={{
              lineHeight: "20px"
            }}
          />

        </PieChart>

      </ResponsiveContainer>

    </div>
  );
};

export default AllocationPie;