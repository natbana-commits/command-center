import { escapeHtml } from "../util/html.js";
import { localDateKey } from "../util/time.js";

// Shared "days until X" badge — originally the Econ events widget's look,
// now reused by Reminders and Calendar so the same at-a-glance countdown
// treatment reads consistently everywhere a date is the primary thing a
// row is organized around.
export interface DaysAwayLabel {
  big: string;
  small: string;
  overdue: boolean;
}

export function daysAwayLabel(dateKey: string, timezone: string): DaysAwayLabel {
  // "Today" has to be resolved in the configured timezone, not the
  // server's own UTC clock — using toISOString() here shifts every badge
  // by a day for the ~4-5 hours each evening (after 8pm ET) where UTC has
  // already rolled to the next date but the local day hasn't.
  const todayKey = localDateKey(new Date(), timezone);
  const days = Math.round(
    (new Date(`${dateKey}T00:00:00Z`).getTime() - new Date(`${todayKey}T00:00:00Z`).getTime()) / 86_400_000
  );
  if (days === 0) return { big: "Today", small: "", overdue: false };
  if (days === 1) return { big: "1", small: "day", overdue: false };
  if (days > 1) return { big: String(days), small: "days", overdue: false };
  if (days === -1) return { big: "1", small: "day late", overdue: true };
  return { big: String(-days), small: "days late", overdue: true };
}

const OVERDUE_COLOR = "#b3441f";

export function renderDayBadge(dateKey: string, color: string, timezone: string): string {
  const label = daysAwayLabel(dateKey, timezone);
  // Hex colors (the common case — category/group colors) get a "66" alpha
  // suffix for a softer border; a var(--token) fallback can't take that
  // suffix (not valid CSS), so it's used as-is.
  const base = label.overdue ? OVERDUE_COLOR : color;
  const borderColor = base.startsWith("var(") ? base : `${base}66`;
  return `
    <div class="day-badge${label.overdue ? " day-badge-overdue" : ""}" style="border-color:${escapeHtml(borderColor)};">
      <span class="day-badge-number"${label.big.length > 2 ? ' style="font-size:14px;"' : ""}>${escapeHtml(label.big)}</span>
      ${label.small ? `<span class="day-badge-unit">${escapeHtml(label.small)}</span>` : ""}
    </div>`;
}
