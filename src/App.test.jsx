import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import App from './App';
import * as api from './api';

// Replace the real api module with mock functions for every test
vi.mock('./api');

beforeEach(() => {
  // Fresh localStorage before each test
  localStorage.clear();
  // Reset all mocks so call counts don't leak between tests
  vi.restoreAllMocks();
});

// ===========================================================================
// 1. DEBOUNCE — search must wait 500ms after typing stops
// ===========================================================================
describe('Search debounce', () => {
  it('should NOT call searchSymbol immediately when user types', async () => {
    // Set up mocks (even though we don't expect them to be called yet)
    api.searchSymbol.mockResolvedValue([{ symbol: 'AAPL', name: 'Apple Inc' }]);
    api.fetchQuote.mockResolvedValue({ price: '150.00', change: '1.00', changePct: '0.67%' });

    render(<App />);
    const input = screen.getByPlaceholderText(/search/i);

    // Type a single character
    await userEvent.type(input, 'A');

    // Immediately after typing: 500ms has NOT passed, so no API call yet
    expect(api.searchSymbol).not.toHaveBeenCalled();

    // Now wait for the debounce to fire (500ms + buffer)
    await waitFor(
      () => expect(api.searchSymbol).toHaveBeenCalledWith('A', expect.anything()),
      { timeout: 700 }
    );
  });

  it('should call searchSymbol only ONCE after typing stops, not per keystroke', async () => {
    api.searchSymbol.mockResolvedValue([{ symbol: 'AAPL', name: 'Apple Inc' }]);
    api.fetchQuote.mockResolvedValue({ price: '150.00', change: '1.00', changePct: '0.67%' });

    render(<App />);
    const input = screen.getByPlaceholderText(/search/i);

    // Type 4 characters rapidly — each one resets the debounce timer
    await userEvent.type(input, 'AAPL');

    // Wait for the single debounced call
    await waitFor(
      () => expect(api.searchSymbol).toHaveBeenCalled(),
      { timeout: 700 }
    );

    // Key assertion: only 1 call total, with the FINAL input value
    expect(api.searchSymbol).toHaveBeenCalledTimes(1);
    expect(api.searchSymbol).toHaveBeenCalledWith('AAPL', expect.anything());
  });
});

// ===========================================================================
// 2. localStorage PERSISTENCE — only symbols, never price data
// ===========================================================================
describe('localStorage persistence', () => {
  it('should persist only the symbol array to localStorage when a stock is added', async () => {
    api.searchSymbol.mockResolvedValue([{ symbol: 'AAPL', name: 'Apple Inc' }]);
    api.fetchQuote.mockResolvedValue({ price: '150.00', change: '1.00', changePct: '0.67%' });

    render(<App />);
    const input = screen.getByPlaceholderText(/search/i);

    // Trigger search
    await userEvent.type(input, 'AAPL');
    await waitFor(() => expect(screen.getByText(/Apple Inc/)).toBeInTheDocument(), { timeout: 700 });

    // Click the search result to add it to the watchlist
    await userEvent.click(screen.getByText(/Apple Inc/));

    // Verify localStorage contains ONLY the symbol string
    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem('watchlist'));
      expect(stored).toEqual(['AAPL']);
    });

    // Extra guard: nothing in localStorage should be an object with a price field
    const stored = JSON.parse(localStorage.getItem('watchlist'));
    stored.forEach((item) => {
      expect(typeof item).toBe('string'); // must be a plain string, not an object
    });
  });

  it('should load symbols from localStorage on mount and fetch their prices', async () => {
    // Pre-populate localStorage as if user had added MSFT in a previous session
    localStorage.setItem('watchlist', JSON.stringify(['MSFT']));
    api.fetchQuote.mockResolvedValue({ price: '380.00', change: '2.50', changePct: '0.66%' });

    render(<App />);

    // The symbol should appear immediately (from localStorage)
    expect(screen.getByText('MSFT')).toBeInTheDocument();
    // And the app should have fetched the quote for it
    expect(api.fetchQuote).toHaveBeenCalledWith('MSFT');
  });
});

// ===========================================================================
// 3. ERROR HANDLING — specific messages for different failure modes
// ===========================================================================
describe('Error handling', () => {
  it('should display a timeout error message when fetchQuote times out', async () => {
    localStorage.setItem('watchlist', JSON.stringify(['AAPL']));
    api.fetchQuote.mockRejectedValue(
      new Error('Connection timed out. Please try again.')
    );

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Connection timed out. Please try again.')).toBeInTheDocument();
    });
  });

  it('should display a rate-limit error message when too many requests are made', async () => {
    localStorage.setItem('watchlist', JSON.stringify(['AAPL']));
    api.fetchQuote.mockRejectedValue(
      new Error('Too many requests. Try again in 1 minute.')
    );

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Too many requests. Try again in 1 minute.')).toBeInTheDocument();
    });
  });
});

// ===========================================================================
// 4. STATE MANAGEMENT — add a stock, then remove it
// ===========================================================================
describe('Add and remove stock', () => {
  it('should add a stock to the watchlist and then remove it cleanly', async () => {
    api.searchSymbol.mockResolvedValue([{ symbol: 'TSLA', name: 'Tesla Inc' }]);
    api.fetchQuote.mockResolvedValue({ price: '250.00', change: '-3.00', changePct: '-1.18%' });

    render(<App />);
    const input = screen.getByPlaceholderText(/search/i);

    // --- ADD ---
    await userEvent.type(input, 'TSLA');
    await waitFor(() => expect(screen.getByText(/Tesla Inc/)).toBeInTheDocument(), { timeout: 700 });
    await userEvent.click(screen.getByText(/Tesla Inc/));

    // Stock card should appear
    await waitFor(() => {
      expect(screen.getByText('TSLA')).toBeInTheDocument();
    });

    // localStorage should contain it
    expect(JSON.parse(localStorage.getItem('watchlist'))).toContain('TSLA');

    // --- REMOVE ---
    // The × button is inside the TSLA card
    const removeBtn = screen.getByText('×');
    await userEvent.click(removeBtn);

    // Stock card should be gone
    await waitFor(() => {
      expect(screen.queryByText('TSLA')).not.toBeInTheDocument();
    });

    // localStorage should be empty now
    expect(JSON.parse(localStorage.getItem('watchlist'))).toEqual([]);
  });
});
