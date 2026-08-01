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
    .find((part) => part.type === "timeZoneName")!.value; // e.g. "GMT-4"

  const offsetHours = parseInt(offsetName.replace("GMT", ""), 10) || 0;
  const sign = offsetHours >= 0 ? "+" : "-";
  return `${sign}${String(Math.abs(offsetHours)).padStart(2, "0")}:00`;
}

// Computes midnight-to-midnight in the given IANA timezone as absolute UTC
// instants, correctly handling DST — the server's own clock runs in UTC,
// which drifts from any local calendar date for several hours each evening.
export function dayBounds(now: Date, timeZone: string): { start: Date; end: Date } {
  const { year, month, day } = dateParts(now, timeZone);
  const offset = utcOffsetString(now, timeZone);

  const start = new Date(`${year}-${month}-${day}T00:00:00${offset}`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
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
