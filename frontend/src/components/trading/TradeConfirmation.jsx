const TradeConfirmation = ({ trade }) => {

  if (!trade) return null;

  return (
    <div className="bg-green-900/30 border border-green-600 p-4 rounded-md mb-4">

      <div className="text-green-400 font-semibold mb-2">
        ✔ Trade Executed
      </div>

      <div className="text-white text-sm space-y-1">

        <div>
          <span className="text-gray-400">Action:</span> {trade.action}
        </div>

        <div>
          <span className="text-gray-400">Symbol:</span> {trade.symbol}
        </div>

        <div>
          <span className="text-gray-400">Quantity:</span> {trade.quantity}
        </div>

        <div>
          <span className="text-gray-400">Price:</span> ${trade.price?.toFixed(2)}
        </div>

        <div>
          <span className="text-gray-400">Total Value:</span> ${trade.total_value}
        </div>

        <div>
          <span className="text-gray-400">Balance:</span> ${trade.balance}
        </div>

      </div>

    </div>
  );
};

export default TradeConfirmation;