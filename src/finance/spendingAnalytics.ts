import type { PlaidTransaction } from "./transactionsStore.js";

export interface SpendingPoint {
  date: string;
  amount: number;
}

export interface CategorySpend {
  category: string;
  amount: number;
}

// Pure aggregations over an already-fetched transaction list — same style
// as recurringCharges.ts's detectRecurringCharges, so both can share one
// upstream query (api/donna-finances.ts's existing 300-row history pull)
// rather than each issuing its own Supabase read.
//
// Plaid's sign convention: positive amount = money out (spend), negative =
// money in (refunds, deposits) — only spend counts here, matching
// recurringCharges.ts's own filter. Pending transactions are excluded
// since their amount/date can still change before settling.
function recentSpend(transactions: PlaidTransaction[], days: number): PlaidTransaction[] {
  const cutoff = Date.now() - days * 86_400_000;
  return transactions.filter((t) => t.amount > 0 && !t.pending && new Date(t.transactionDate).getTime() >= cutoff);
}

export function getSpendingHistory(transactions: PlaidTransaction[], days = 90): SpendingPoint[] {
  const byDate = new Map<string, number>();
  for (const t of recentSpend(transactions, days)) {
    byDate.set(t.transactionDate, (byDate.get(t.transactionDate) ?? 0) + t.amount);
  }
  return [...byDate.entries()]
    .map(([date, amount]) => ({ date, amount }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function getSpendingByCategory(transactions: PlaidTransaction[], days = 30): CategorySpend[] {
  const byCategory = new Map<string, number>();
  for (const t of recentSpend(transactions, days)) {
    const key = t.category ?? "Uncategorized";
    byCategory.set(key, (byCategory.get(key) ?? 0) + t.amount);
  }
  return [...byCategory.entries()]
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);
}
