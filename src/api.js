// Global Variables

const API_KEY = import.meta.env.VITE_ALPHA_VANTAGE_API_KEY;
const BASE_URL = 'https://www.alphavantage.co/query';
const TIMEOUT_MS = 5000; // 5-second timeout per the assignment

// ---------------------------------------------------------------------------
// MOCK DATA — used automatically when the real API returns a rate-limit error.
// ---------------------------------------------------------------------------
const MOCK_SEARCH_DATA = {
  aapl: [{ symbol: 'AAPL', name: 'Apple Inc' }, { symbol: 'AAPLX', name: 'Apple Hospitality REIT' }],
  googl: [{ symbol: 'GOOGL', name: 'Alphabet Inc - Class A' }],
  msft: [{ symbol: 'MSFT', name: 'Microsoft Corp' }],
  tsla: [{ symbol: 'TSLA', name: 'Tesla Inc' }],
  amzn: [{ symbol: 'AMZN', name: 'Amazon.com Inc' }],
  nvda: [{ symbol: 'NVDA', name: 'NVIDIA Corp' }],
  meta: [{ symbol: 'META', name: 'Meta Platforms Inc' }],
};

const MOCK_QUOTE_DATA = {
  AAPL:  { price: '228.87', change: '2.45',  changePct: '1.08%' },
  GOOGL: { price: '189.25', change: '-1.30', changePct: '-0.68%' },
  MSFT:  { price: '409.18', change: '5.20',  changePct: '1.29%' },
  TSLA:  { price: '350.40', change: '-8.75', changePct: '-2.44%' },
  AMZN:  { price: '229.10', change: '3.60',  changePct: '1.60%' },
  NVDA:  { price: '132.65', change: '1.90',  changePct: '1.45%' },
  META:  { price: '612.00', change: '-4.10', changePct: '-0.67%' },
};

// ---------------------------------------------------------------------------
// Helper: fetch with a built-in timeout.
// ---------------------------------------------------------------------------
async function fetchWithTimeout(url, externalSignal) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  if (externalSignal) {
    externalSignal.addEventListener('abort', () => controller.abort());
  }

  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    return res;
  } catch (err) {
    clearTimeout(timeoutId);
    if (externalSignal && externalSignal.aborted) {
      throw err; // AbortError — caller will ignore this
    }
    if (err.name === 'AbortError') {
      throw new Error('timeout');
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Handle rate-limit messages
// ---------------------------------------------------------------------------
function isRateLimited(text) {
  const lower = (text || '').toLowerCase();
  return (
    lower.includes('thank you for your patience') ||
    lower.includes('call frequency') ||
    lower.includes('premium') ||
    lower.includes('rate limit') ||
    lower.includes('too many')
  );
}

// ---------------------------------------------------------------------------
// Mapping raw errors per assignment guidelines
// ---------------------------------------------------------------------------
function parseError(err, rawBody) {
  const combined = (err?.message || '') + ' ' + (rawBody || '');

  if (combined.includes('timeout')) {
    return 'Connection timed out. Please try again.';
  }
  if (combined.includes('429') || isRateLimited(combined)) {
    return 'Too many requests. Try again in 1 minute.';
  }
  if (combined.includes('Invalid API') || combined.includes('invalid')) {
    return 'Configuration error. Please contact support.';
  }
  if (combined.includes('not found') || combined.includes('No data')) {
    return 'Symbol not found. Check your spelling.';
  }
  return 'Something went wrong. Please try again.';
}

// ---------------------------------------------------------------------------
// SYMBOL_SEARCH — returns [{ symbol, name }, ...]
// Falls back to mock data if rate-limited.
// ---------------------------------------------------------------------------
export async function searchSymbol(keyword, signal) {
  const url =
    BASE_URL +
    '?function=SYMBOL_SEARCH' +
    '&keywords=' + encodeURIComponent(keyword) +
    '&apikey=' + API_KEY;

  let rawBody = '';
  try {
    const res = await fetchWithTimeout(url, signal);
    rawBody = await res.text();

    // Log the raw response so you can see exactly what AV sent back
    console.log('[searchSymbol] raw response:', rawBody);

    const json = JSON.parse(rawBody);

    // Check for rate limit FIRST — if hit, fall back to mock
    if (json['Information'] || json['Note']) {
      const msg = json['Information'] || json['Note'];
      if (isRateLimited(msg)) {
        console.log('[searchSymbol] Rate limited — using mock data');
        return getMockSearchResults(keyword);
      }
      // Not a rate limit — some other AV error
      throw new Error(msg);
    }

    const matches = json['bestMatches'] || [];
    if (matches.length === 0) {
      throw new Error('Symbol not found. Check your spelling.');
    }

    return matches.map((m) => ({
      symbol: m['1. symbol'],
      name: m['2. name'],
    }));
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    if (err.message === 'Symbol not found. Check your spelling.') throw err;
    throw new Error(parseError(err, rawBody));
  }
}

// ---------------------------------------------------------------------------
// GLOBAL_QUOTE — returns { price, change, changePct }
// Falls back to mock data if rate-limited.
// ---------------------------------------------------------------------------
export async function fetchQuote(symbol) {
  const url =
    BASE_URL +
    '?function=GLOBAL_QUOTE' +
    '&symbol=' + encodeURIComponent(symbol) +
    '&apikey=' + API_KEY;

  let rawBody = '';
  try {
    const res = await fetchWithTimeout(url);
    rawBody = await res.text();

    console.log('[fetchQuote] raw response for ' + symbol + ':', rawBody);

    const json = JSON.parse(rawBody);

    if (json['Information'] || json['Note']) {
      const msg = json['Information'] || json['Note'];
      if (isRateLimited(msg)) {
        console.log('[fetchQuote] Rate limited — using mock data for ' + symbol);
        return getMockQuote(symbol);
      }
      throw new Error(msg);
    }

    const quote = json['Global Quote'];
    if (!quote || !quote['05. price']) {
      throw new Error('Symbol not found. Check your spelling.');
    }

    return {
      price: parseFloat(quote['05. price']).toFixed(2),
      change: parseFloat(quote['08. change']).toFixed(2),
      changePct: quote['10. change percent'] || '0.00%',
    };
  } catch (err) {
    if (err.message === 'Symbol not found. Check your spelling.') throw err;
    throw new Error(parseError(err, rawBody));
  }
}

// ---------------------------------------------------------------------------
// Mock helpers — only called when rate-limited
// ---------------------------------------------------------------------------
function getMockSearchResults(keyword) {
  const key = keyword.toLowerCase();
  // Check for exact match first, then check if any mock key starts with the input
  if (MOCK_SEARCH_DATA[key]) return MOCK_SEARCH_DATA[key];
  const partial = Object.keys(MOCK_SEARCH_DATA).find((k) => k.startsWith(key));
  if (partial) return MOCK_SEARCH_DATA[partial];
  throw new Error('Symbol not found. Check your spelling.');
}

function getMockQuote(symbol) {
  if (MOCK_QUOTE_DATA[symbol]) return MOCK_QUOTE_DATA[symbol];
  // If the symbol isn't in our mock list, return a generic placeholder
  return { price: '100.00', change: '0.50', changePct: '0.50%' };
}
