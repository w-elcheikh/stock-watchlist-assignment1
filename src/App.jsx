import { useState, useEffect, useCallback } from 'react';
import SearchBar from './SearchBar';
import StockCard from './StockCard';
import { fetchQuote } from './api';

const MAX_STOCKS = 5;

function App() {
  // ---------------------------------------------------------------------------
  // watchlist: array of symbol strings, e.g. ["AAPL", "GOOGL"]
  // Initialized from localStorage. This is the ONLY thing we persist.
  // ---------------------------------------------------------------------------
  const [watchlist, setWatchlist] = useState(() => {
    const saved = localStorage.getItem('watchlist');
    return saved ? JSON.parse(saved) : [];
  });

  // ---------------------------------------------------------------------------
  // stockData: { AAPL: { price, change, changePct, lastUpdated, loading, error } }
  // Lives in memory only. Re-fetched on every page load.
  // ---------------------------------------------------------------------------
  const [stockData, setStockData] = useState({});

  // ---------------------------------------------------------------------------
  // Persist watchlist to localStorage whenever it changes.
  // Only symbols are written — never price data.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    localStorage.setItem('watchlist', JSON.stringify(watchlist));
  }, [watchlist]);

  // ---------------------------------------------------------------------------
  // fetchStock: fetches fresh price for ONE symbol.
  // Sets that symbol's loading state independently — other cards are unaffected.
  // ---------------------------------------------------------------------------
  const fetchStock = useCallback(async (symbol) => {
    // Mark THIS stock as loading
    setStockData((prev) => ({
      ...prev,
      [symbol]: { ...(prev[symbol] || {}), loading: true, error: null },
    }));

    try {
      const data = await fetchQuote(symbol);
      // Success: store price + timestamp
      setStockData((prev) => ({
        ...prev,
        [symbol]: {
          price: data.price,
          change: data.change,
          changePct: data.changePct,
          lastUpdated: Date.now(),
          loading: false,
          error: null,
        },
      }));
    } catch (err) {
      // Error: store error message, keep loading false
      setStockData((prev) => ({
        ...prev,
        [symbol]: { ...(prev[symbol] || {}), loading: false, error: err.message },
      }));
    }
  }, []); // no deps — setStockData is stable, fetchQuote is a module import

  // ---------------------------------------------------------------------------
  // On mount: fetch prices for any symbols already in localStorage.
  // This runs exactly ONCE. Adding new stocks triggers fetchStock directly.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    watchlist.forEach((symbol) => fetchStock(symbol));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally empty — mount only

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------
  const handleAdd = (symbol) => {
    if (watchlist.length >= MAX_STOCKS) return;
    if (watchlist.includes(symbol)) return;
    setWatchlist((prev) => [...prev, symbol]);
    fetchStock(symbol); // fetch only the new stock, not all of them
  };

  const handleRemove = (symbol) => {
    setWatchlist((prev) => prev.filter((s) => s !== symbol));
    // Also remove its price data from memory
    setStockData((prev) => {
      const next = { ...prev };
      delete next[symbol];
      return next;
    });
  };

  const handleRefreshAll = () => {
    watchlist.forEach((symbol) => fetchStock(symbol));
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="app">
      <h1>Stock Watchlist</h1>

      <SearchBar onAdd={handleAdd} watchlist={watchlist} />

      {watchlist.length >= MAX_STOCKS && (
        <p className="limit-warning">Watchlist full — max {MAX_STOCKS} stocks.</p>
      )}

      {watchlist.length > 0 && (
        <button className="refresh-btn" onClick={handleRefreshAll}>
          Refresh All
        </button>
      )}

      <div className="watchlist">
        {watchlist.map((symbol) => (
          <StockCard
            key={symbol}
            symbol={symbol}
            data={stockData[symbol]}
            onRemove={() => handleRemove(symbol)}
          />
        ))}
      </div>
    </div>
  );
}

export default App;
