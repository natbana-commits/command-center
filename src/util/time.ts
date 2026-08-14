function dateParts(now: Date, timeZone: string): { year: string; month: string; day: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .formatToParts(now)
    .reduce<Record<string, string>>((acc, part) => {
      acc[part.type] = part.value;
      return acc;
    }, {});
  return { year: parts.year, month: parts.month, day: parts.day };
}

export function localDateKey(now: Date, timeZone: string): string {
  const { year, month, day } = dateParts(now, timeZone);
  return `${year}-${month}-${day}`;
}

function utcOffsetString(at: Date, timeZone: string): string {
  const offsetName = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "shortOffset",
  })
    .formatToParts(at)
    .find((part) => part.type === "timeZoneName")!.value; // e.g. "GMT-4" or "GMT+5:30"

  // Half-hour and 45-minute zones (India GMT+5:30, Nepal GMT+5:45) carry a
  // ":MM" suffix that a bare parseInt on the whole string silently drops —
  // unreachable today (only America/New_York is configured) but latent
  // once the timezone setting accepts arbitrary IANA zones.
  const match = offsetName.match(/^GMT([+-])(\d{1,2})(?::(\d{2}))?$/);
  if (!match) return "+00:00";
  const [, sign, hours, minutes] = match;
  return `${sign}${hours.padStart(2, "0")}:${(minutes ?? "00").padStart(2, "0")}`;
}

// Resolves the UTC instant for local midnight of a Y-M-D date in
// `timeZone`, using the offset actually in effect AT that midnight rather
// than at some other moment. A single offset("now") lookup — the previous
// approach — is wrong on the two DST-transition days each year: the offset
// sampled at, say, 10am can differ from the offset that was in effect at
// midnight that same local day, since the transition happens a couple
// hours after midnight. Two passes converge because a timezone's offset
// changes by a fixed amount at most once around any given calendar day —
// pass 1 gets close enough that pass 2, evaluated at that near-midnight
// guess instead of an arbitrary "now", lands on the correct side of the
// transition.
function zonedMidnight(year: string, month: string, day: string, timeZone: string): Date {
  const naive = new Date(`${year}-${month}-${day}T00:00:00Z`);
  const guessOffset = utcOffsetString(naive, timeZone);
  const guess = new Date(`${year}-${month}-${day}T00:00:00${guessOffset}`);
  const offset = utcOffsetString(guess, timeZone);
  return new Date(`${year}-${month}-${day}T00:00:00${offset}`);
}

// Plain calendar-date arithmetic (Y-M-D + 1, with month/year rollover
// handled by the Date constructor's own normalization) — deliberately not
// "add N hours and re-derive the date", which was tried and is wrong: no
// fixed number of hours reliably lands one calendar day forward for every
// day length a DST transition can produce (23h/24h/25h).
function nextDayParts(year: string, month: string, day: string): { year: string; month: string; day: string } {
  const d = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  d.setUTCDate(d.getUTCDate() + 1);
  return {
    year: String(d.getUTCFullYear()),
    month: String(d.getUTCMonth() + 1).padStart(2, "0"),
    day: String(d.getUTCDate()).padStart(2, "0"),
  };
}

// Computes midnight-to-midnight in the given IANA timezone as absolute UTC
// instants — the server's own clock runs in UTC, which drifts from any
// local calendar date for several hours each evening. `end` is resolved as
// its own local midnight (not `start + 24h`) since the day `now` falls on
// can itself be 23 or 25 hours long on a DST-transition day.
export function dayBounds(now: Date, timeZone: string): { start: Date; end: Date } {
  const { year, month, day } = dateParts(now, timeZone);
  const start = zonedMidnight(year, month, day, timeZone);

  const next = nextDayParts(year, month, day);
  const end = zonedMidnight(next.year, next.month, next.day, timeZone);
  return { start, end };
}

// Combines a plain "YYYY-MM-DD" date and "HH:mm" time (as typed into an
// <input type="date">/<input type="time">) into an absolute ISO instant in
// the given timezone — for form-submitted due dates/times. Uses "now" to
// resolve the DST offset, same approximation dayBounds already makes.
export function localDateTimeToIso(dateStr: string, timeStr: string, timeZone: string): string {
  const offset = utcOffsetString(new Date(), timeZone);
  const time = timeStr || "00:00";
  return new Date(`${dateStr}T${time}:00${offset}`).toISOString();
}

// The inverse of localDateTimeToIso — splits an absolute instant back into
// the "YYYY-MM-DD" and "HH:mm" strings an <input type="date">/type="time">
// expects, in the given timezone, for prefilling an edit form.
export function toLocalDateTimeParts(iso: string, timeZone: string): { date: string; time: string } {
  const at = new Date(iso);
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(at);
  return { date, time };
}

// Best-effort resolver for contexts (the Telegram webhook) that can't afford
// to refetch the ICS feed just to resolve "auto" the way calendar.ts does.
export function resolveTimezone(configured: string): string {
  return configured === "auto" ? "America/New_York" : configured;
}

const WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

// 0 (Sunday) through 6 (Saturday), matching briefConfig.weeklyDigestDay —
// computed from the IANA timezone name rather than Date.getDay(), which
// only ever reflects the server's own local time (UTC on Vercel).
export function localWeekdayIndex(now: Date, timeZone: string): number {
  const short = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(now);
  return WEEKDAY_INDEX[short] ?? now.getUTCDay();
}

export function addDaysToDateKey(dateKey: string, days: number): string {
  const d = new Date(`${dateKey}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Consecutive days ending today (if today's already in the set) or
// yesterday (if today isn't in the set yet but the streak up to yesterday
// is unbroken — "you haven't missed it YET today" reads better than
// zeroing out a streak the moment the clock passes midnight and before
// there's been a chance to check it off/log it). Shared by habit streaks
// and study-session streaks — same semantics either way.
export function consecutiveDayStreak(dateKeys: Set<string>, todayKey: string): number {
  let cursor = dateKeys.has(todayKey) ? todayKey : addDaysToDateKey(todayKey, -1);
  let streak = 0;
  while (dateKeys.has(cursor)) {
    streak += 1;
    cursor = addDaysToDateKey(cursor, -1);
  }
  return streak;
}

export function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMinutes = Math.round(diffMs / 60000);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (Math.abs(diffMinutes) < 60) return rtf.format(-diffMinutes, "minute");
  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) return rtf.format(-diffHours, "hour");
  const diffDays = Math.round(diffHours / 24);
  return rtf.format(-diffDays, "day");
}

export function formatTimeLabel(iso: string, timeZone: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { timeZone, hour: "numeric", minute: "2-digit" });
}

const TIME_SUFFIX_RE = / \(\d{1,2}:\d{2}\s?(AM|PM)\)$/i;

// Google Tasks' `due` field is date-only (see the comment on
// reminder_notifications in supabase/schema.sql) — it never shows a time
// in Google Tasks or Calendar no matter what's sent. Baking the real time
// into the title itself is the only way it's visible in Google's own
// apps. Strips any previous suffix first so re-editing a reminder can't
// pile up "(2pm) (3pm) (2pm)" — idempotent regardless of how many times
// it's edited, and passing `timeLabel: null` cleanly removes it if the
// time is cleared.
export function withTimeSuffix(title: string, timeLabel: string | null): string {
  const bare = title.replace(TIME_SUFFIX_RE, "").trim();
  return timeLabel ? `${bare} (${timeLabel})` : bare;
}
