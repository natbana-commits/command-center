import { getOrFetch } from "../util/cache.js";

export interface Quote {
  symbol: string;
  price: number;
  changePercent: number;
}

export function isFinnhubConfigured(): boolean {
  return Boolean(process.env.FINNHUB_API_KEY);
}

// Finnhub returns all-zero fields for a symbol it doesn't recognize
// (c: 0) rather than an error — that's the signal a Watchlist label isn't
// a real ticker (Watchlist entries are free-text company names/tickers,
// not validated against a symbol list anywhere), so those are silently
// skipped rather than shown broken.
async function fetchQuote(symbol: string): Promise<Quote | null> {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) return null;

  const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`;
  const response = await fetch(url);
  if (!response.ok) return null;

  const data = (await response.json()) as { c?: number; pc?: number };
  if (!data.c) return null;

  const changePercent = data.pc ? ((data.c - data.pc) / data.pc) * 100 : 0;
  return { symbol, price: data.c, changePercent };
}

// 60s TTL — comfortably under Finnhub's free-tier 60-calls/minute limit
// even with a watchlist of several tickers, for a page that isn't loaded
// more than a handful of times a minute by one person.
export async function getWatchlistQuotes(labels: string[]): Promise<Quote[]> {
  if (!isFinnhubConfigured() || labels.length === 0) return [];

  const results = await Promise.all(
    labels.map((label) => {
      const symbol = label.trim().toUpperCase();
      return getOrFetch(`market-quote:${symbol}`, 60, () => fetchQuote(symbol));
    })
  );
  return results.filter((q): q is Quote => q !== null);
}
