import type { PlaidTransaction } from "./transactionsStore.js";

export interface RecurringCharge {
  label: string;
  averageAmount: number;
  lastChargeDate: string;
  nextDueDate: string;
  occurrences: number;
}

const AMOUNT_TOLERANCE = 0.1; // 10%
const MIN_INTERVAL_DAYS = 25;
const MAX_INTERVAL_DAYS = 35;
const MIN_OCCURRENCES = 2;

function daysBetween(a: string, b: string): number {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 86_400_000;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setUTCDate(d.getUTCDate() + Math.round(days));
  return d.toISOString().slice(0, 10);
}

// Groups spend by merchant, then only calls it "recurring" when EVERY
// consecutive gap between charges lands in the ~monthly window and every
// consecutive amount stays within tolerance — a single coincidental repeat
// purchase at a similar amount won't false-positive unless it happens to
// also land almost exactly a month apart, which a genuine one-off won't.
export function detectRecurringCharges(transactions: PlaidTransaction[]): RecurringCharge[] {
  // Plaid's sign convention: positive amount = money out. Pending
  // transactions haven't settled yet and can still change amount/date.
  const spend = transactions.filter((t) => t.amount > 0 && !t.pending);

  const groups = new Map<string, PlaidTransaction[]>();
  for (const t of spend) {
    const key = (t.merchantName ?? t.name).trim().toLowerCase();
    if (!key) continue;
    const list = groups.get(key);
    if (list) {
      list.push(t);
    } else {
      groups.set(key, [t]);
    }
  }

  const results: RecurringCharge[] = [];
  for (const group of groups.values()) {
    if (group.length < MIN_OCCURRENCES) continue;
    const sorted = [...group].sort(
      (a, b) => new Date(a.transactionDate).getTime() - new Date(b.transactionDate).getTime()
    );

    let isRecurring = true;
    const gaps: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const gapDays = daysBetween(sorted[i - 1].transactionDate, sorted[i].transactionDate);
      if (gapDays < MIN_INTERVAL_DAYS || gapDays > MAX_INTERVAL_DAYS) {
        isRecurring = false;
        break;
      }
      gaps.push(gapDays);
      const prevAmount = sorted[i - 1].amount;
      const amountDiff = Math.abs(sorted[i].amount - prevAmount) / Math.max(prevAmount, 0.01);
      if (amountDiff > AMOUNT_TOLERANCE) {
        isRecurring = false;
        break;
      }
    }
    if (!isRecurring) continue;

    const last = sorted[sorted.length - 1];
    // This merchant's own observed cadence (e.g. a biller that always
    // charges every 28 days) predicts the next date more precisely than a
    // flat 30 — gaps is non-empty here since MIN_OCCURRENCES is 2.
    const avgGapDays = gaps.reduce((sum, g) => sum + g, 0) / gaps.length;
    results.push({
      label: last.merchantName ?? last.name,
      averageAmount: sorted.reduce((sum, t) => sum + t.amount, 0) / sorted.length,
      lastChargeDate: last.transactionDate,
      nextDueDate: addDays(last.transactionDate, avgGapDays),
      occurrences: sorted.length,
    });
  }

  return results.sort((a, b) => b.averageAmount - a.averageAmount);
}
