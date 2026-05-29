import usePerformance from "../hooks/usePerformance";

const Performance = () => {
  const data = usePerformance();

  if (!data) return <div>Loading...</div>;

  const { metrics, equityCurve } = data;

  return (
    <div className="p-6 space-y-6">

      <h1 className="text-white text-2xl">Performance</h1>

      {/* METRICS */}
      <div className="grid grid-cols-4 gap-4">

        <Card title="Return" value={metrics.total_return} />
        <Card title="Sharpe" value={metrics.sharpe_ratio} />
        <Card title="Volatility" value={metrics.volatility} />
        <Card title="Drawdown" value={metrics.max_drawdown} />

      </div>

      {/* EQUITY CURVE */}
      <div className="bg-gray-900 p-4 rounded-xl">
        {equityCurve.map((p, i) => (
          <div key={i}>{p.equity}</div>
        ))}
      </div>

    </div>
  );
};

const Card = ({ title, value }) => (
  <div className="bg-gray-800 p-4 rounded">
    <p className="text-gray-400">{title}</p>
    <p className="text-white text-xl">{value}</p>
  </div>
);

export default Performance;