import { useState } from "react";
import { STOCK_SYMBOLS } from "../../utils/stockSymbols";

const SymbolSearch = ({ value, onChange }) => {

  const [query, setQuery] = useState(value);
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);

  const handleChange = (e) => {

    const val = e.target.value.toUpperCase();
    setQuery(val);
    onChange(val);

    if (val.length === 0) {
      setResults(STOCK_SYMBOLS.slice(0,10));
      setOpen(true);
      return;
    }

    const filtered = STOCK_SYMBOLS.filter((symbol) =>
      symbol.startsWith(val)
    );

    setResults(filtered.slice(0,10));
    setOpen(true);
  };

  const toggleDropdown = () => {

    if (open) {
      setOpen(false);
    } else {
      setResults(STOCK_SYMBOLS.slice(0,10));
      setOpen(true);
    }
  };

  const selectSymbol = (symbol) => {
    setQuery(symbol);
    onChange(symbol);
    setOpen(false);
  };

  return (
    <div className="relative">

      <div className="flex">

        <input
          type="text"
          value={query}
          onChange={handleChange}
          className="w-full p-2 rounded-l bg-gray-800 text-white"
        />

        <button
          onClick={toggleDropdown}
          className="px-2 py-1 bg-gray-700 rounded transition-all duration-200 hover:bg-blue-500"
        >
          ▼
        </button>

      </div>

      {open && results.length > 0 && (
        <div className="absolute bg-gray-800 border border-gray-700 w-full mt-1 rounded shadow z-50">

          {results.map((symbol) => (
            <div
              key={symbol}
              onClick={() => selectSymbol(symbol)}
              className="p-2 hover:bg-gray-700 cursor-pointer"
            >
              {symbol}
            </div>
          ))}

        </div>
      )}

    </div>
  );
};

export default SymbolSearch;