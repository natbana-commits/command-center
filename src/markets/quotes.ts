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
// more than a handful of times a minute by one person. One cache row for
// the whole watchlist (keyed on its sorted symbol set) rather than one
// per ticker — same number of Finnhub calls on a cache miss (still done
// via Promise.all below), but one Supabase round trip instead of N on
// every warm load.
export async function getWatchlistQuotes(labels: string[]): Promise<Quote[]> {
  if (!isFinnhubConfigured() || labels.length === 0) return [];

  const symbols = [...new Set(labels.map((label) => label.trim().toUpperCase()))].sort();
  const results = await getOrFetch(`market-quotes:${symbols.join(",")}`, 60, async () => {
    const quotes = await Promise.all(symbols.map((symbol) => fetchQuote(symbol)));
    return quotes.filter((q): q is Quote => q !== null);
  });
  return results;
}
