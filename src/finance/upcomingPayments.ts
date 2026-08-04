import type { RecurringCharge } from "./recurringCharges.js";
import type { ManualBill } from "./manualBills.js";
import { localDateKey } from "../util/time.js";

export interface UpcomingPayment {
  label: string;
  amount: number;
  dueDate: string; // YYYY-MM-DD
  source: "auto" | "manual";
  manualBillId?: number;
}

function daysInMonth(year: number, month: number): number {
  // Date's day=0 rolls back to the last day of the *previous* month, so
  // passing `month` (1-indexed) here lands on the last day of that month.
  return new Date(year, month, 0).getDate();
}

// A manual bill only stores a day-of-month — this resolves that into the
// next actual calendar date from "today" (in the configured timezone),
// rolling into next month once this month's due day has passed, and
// clamping to a shorter month's actual last day (e.g. a "31" bill in
// February lands on the 28th/29th).
export function nextDueDateFromDay(dueDay: number, timezone: string): string {
  const todayKey = localDateKey(new Date(), timezone);
  const [year, month, day] = todayKey.split("-").map(Number);

  let candidateYear = year;
  let candidateMonth = month;
  let candidateDay = Math.min(dueDay, daysInMonth(candidateYear, candidateMonth));

  if (candidateDay < day) {
    candidateMonth += 1;
    if (candidateMonth > 12) {
      candidateMonth = 1;
      candidateYear += 1;
    }
    candidateDay = Math.min(dueDay, daysInMonth(candidateYear, candidateMonth));
  }

  return `${candidateYear}-${String(candidateMonth).padStart(2, "0")}-${String(candidateDay).padStart(2, "0")}`;
}

export function buildUpcomingPayments(
  recurringCharges: RecurringCharge[],
  manualBills: ManualBill[],
  timezone: string
): UpcomingPayment[] {
  const auto: UpcomingPayment[] = recurringCharges.map((c) => ({
    label: c.label,
    amount: c.averageAmount,
    dueDate: c.nextDueDate,
    source: "auto",
  }));
  const manual: UpcomingPayment[] = manualBills.map((b) => ({
    label: b.name,
    amount: b.amount,
    dueDate: nextDueDateFromDay(b.dueDay, timezone),
    source: "manual",
    manualBillId: b.id,
  }));

  return [...auto, ...manual].sort((a, b) => (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0));
}
