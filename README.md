## Architecture

The app is split into three layers. `api.js` owns all network calls — no component ever calls `fetch()` directly. This makes error handling consistent and makes testing easy (we just mock that one file). `App.jsx` owns all state: the watchlist (an array of symbol strings persisted to localStorage) and the price data (an object keyed by symbol, kept only in memory). Components (`SearchBar`, `StockCard`) receive data and callbacks via props — they don't manage their own global state.

The debounce is hand-rolled in `SearchBar` using `setTimeout` refs. Each keystroke clears the previous timer and sets a new 500ms one. An `AbortController` cancels any in-flight fetch when new input arrives or the component unmounts, preventing stale responses and memory leaks.

Per-stock loading and error states are stored as separate keys in the `stockData` object (`{ AAPL: { loading, error, price, ... } }`). This means refreshing one stock or one stock failing doesn't affect the others. The "Last updated" counter is a simple `setInterval` in each `StockCard`, reset whenever that card's `lastUpdated` timestamp changes.

### Known limitations

- The Alpha Vantage free tier allows only 25 requests/day and 5/minute. Heavy testing will exhaust the daily quota quickly. The unit tests mock the API so they don't consume real requests.
- No authentication — single-user localStorage only.
- No offline support beyond persisted symbols.
