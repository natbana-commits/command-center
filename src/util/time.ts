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

// Computes midnight-to-midnight in the given IANA timezone as absolute UTC
// instants, correctly handling DST — the server's own clock runs in UTC,
// which drifts from any local calendar date for several hours each evening.
export function dayBounds(now: Date, timeZone: string): { start: Date; end: Date } {
  const { year, month, day } = dateParts(now, timeZone);

  const offsetName = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "shortOffset",
  })
    .formatToParts(now)
    .find((part) => part.type === "timeZoneName")!.value; // e.g. "GMT-4"

  const offsetHours = parseInt(offsetName.replace("GMT", ""), 10) || 0;
  const sign = offsetHours >= 0 ? "+" : "-";
  const offset = `${sign}${String(Math.abs(offsetHours)).padStart(2, "0")}:00`;

  const start = new Date(`${year}-${month}-${day}T00:00:00${offset}`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

// Best-effort resolver for contexts (the Telegram webhook) that can't afford
// to refetch the ICS feed just to resolve "auto" the way calendar.ts does.
export function resolveTimezone(configured: string): string {
  return configured === "auto" ? "America/New_York" : configured;
}
