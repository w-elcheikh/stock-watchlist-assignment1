import { useState, useRef, useEffect } from 'react';
import { searchSymbol } from './api';

function SearchBar({ onAdd, watchlist }) {
  const [input, setInput] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Refs for debounce timer and in-flight request cancellation
  const debounceTimer = useRef(null);
  const abortController = useRef(null);

  // Cleanup on unmount — prevents state updates on dead component
  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      if (abortController.current) abortController.current.abort();
    };
  }, []);

  const handleChange = (e) => {
    const value = e.target.value;
    setInput(value);
    setError(null);

    // Clear the previous debounce timer every keystroke
    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    // If input is empty, just clear results — no API call needed
    if (!value.trim()) {
      setResults([]);
      return;
    }

    // Set a NEW 500ms timer. Only the last one survives.
    // This IS the debounce — every keystroke resets the clock.
    debounceTimer.current = setTimeout(async () => {
      // Cancel any previous in-flight search request
      if (abortController.current) abortController.current.abort();
      abortController.current = new AbortController();

      setLoading(true);
      try {
        const data = await searchSymbol(value, abortController.current.signal);
        setResults(data);
      } catch (err) {
        // AbortError means WE cancelled it (new input arrived) — not a real error
        if (err.name !== 'AbortError') {
          setError(err.message);
          setResults([]);
        }
      } finally {
        setLoading(false);
      }
    }, 500);
  };

  const handleSelect = (symbol) => {
    // Guard: duplicate or limit
    if (watchlist.includes(symbol)) {
      alert(symbol + ' is already in your watchlist.');
      return;
    }
    if (watchlist.length >= 5) {
      alert('Watchlist is full (max 5 stocks).');
      return;
    }
    onAdd(symbol);
    setResults([]);
    setInput('');
  };

  return (
    <div className="search-bar">
      <input
        type="text"
        placeholder="Search stocks (e.g. AAPL)"
        value={input}
        onChange={handleChange}
      />
      {loading && <p className="search-status">Searching...</p>}
      {error && <p className="search-error">{error}</p>}
      {results.length > 0 && (
        <ul className="results-dropdown">
          {results.map((r) => (
            <li key={r.symbol} onClick={() => handleSelect(r.symbol)}>
              <strong>{r.symbol}</strong> — {r.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default SearchBar;
