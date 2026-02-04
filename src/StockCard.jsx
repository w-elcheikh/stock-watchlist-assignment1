import { useState, useEffect, useRef } from 'react';

function StockCard({ symbol, data, onRemove }) {
  const [secondsAgo, setSecondsAgo] = useState(0);
  const intervalRef = useRef(null);

  // Start/reset the "X seconds ago" counter whenever lastUpdated changes
  useEffect(() => {
    // Clean up any existing interval first
    if (intervalRef.current) clearInterval(intervalRef.current);

    if (data && data.lastUpdated) {
      // Set initial value immediately
      setSecondsAgo(Math.round((Date.now() - data.lastUpdated) / 1000));
      // Then tick every second
      intervalRef.current = setInterval(() => {
        setSecondsAgo((prev) => prev + 1);
      }, 1000);
    }

    // Cleanup: stop the interval when component unmounts or lastUpdated changes
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [data && data.lastUpdated]); // re-run only when lastUpdated changes

  // --- Render states (mutually exclusive) ---

  // 1. Loading (no data yet, or actively fetching)
  if (!data || data.loading) {
    return (
      <div className="stock-card">
        <div className="card-header">
          <h3>{symbol}</h3>
          <button className="remove-btn" onClick={onRemove}>&times;</button>
        </div>
        <p className="loading">Loading...</p>
      </div>
    );
  }

  // 2. Error
  if (data.error) {
    return (
      <div className="stock-card">
        <div className="card-header">
          <h3>{symbol}</h3>
          <button className="remove-btn" onClick={onRemove}>&times;</button>
        </div>
        <p className="error">{data.error}</p>
      </div>
    );
  }

  // 3. Success — show price data
  const isPositive = parseFloat(data.change) >= 0;

  return (
    <div className="stock-card">
      <div className="card-header">
        <h3>{symbol}</h3>
        <button className="remove-btn" onClick={onRemove}>&times;</button>
      </div>
      <p className="price">${data.price}</p>
      <p className={'change ' + (isPositive ? 'positive' : 'negative')}>
        {isPositive ? '+' : ''}{data.change} ({data.changePct})
      </p>
      <p className="timestamp">Last updated: {secondsAgo}s ago</p>
    </div>
  );
}

export default StockCard;
