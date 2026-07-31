import ical, { type VEvent } from "node-ical";

function summaryText(summary: VEvent["summary"]): string {
  return typeof summary === "string" ? summary : summary.val;
}

export interface CalendarEvent {
  summary: string;
  start: Date;
}

export interface CalendarResult {
  events: CalendarEvent[];
  timezone: string;
}

// Computes midnight-to-midnight in the given IANA timezone as absolute UTC
// instants, correctly handling DST — the server's own clock runs in UTC,
// which drifts from any local calendar date for several hours each evening.
function dayBounds(now: Date, timeZone: string): { start: Date; end: Date } {
  const dateParts = new Intl.DateTimeFormat("en-CA", {
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

  const offsetName = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "shortOffset",
  })
    .formatToParts(now)
    .find((part) => part.type === "timeZoneName")!.value; // e.g. "GMT-4"

  const offsetHours = parseInt(offsetName.replace("GMT", ""), 10) || 0;
  const sign = offsetHours >= 0 ? "+" : "-";
  const offset = `${sign}${String(Math.abs(offsetHours)).padStart(2, "0")}:00`;

  const start = new Date(`${dateParts.year}-${dateParts.month}-${dateParts.day}T00:00:00${offset}`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

export async function getTodaysEvents(configuredTimezone: string): Promise<CalendarResult> {
  const url = process.env.GOOGLE_CALENDAR_ICS_URL;
  if (!url) {
    throw new Error("Missing GOOGLE_CALENDAR_ICS_URL in environment");
  }

  const data = await ical.async.fromURL(url);

  // "auto" follows the calendar's own configured timezone (Google includes
  // this in every feed as WR-TIMEZONE); anything else is a manual override.
  const feedTimezone = (data.vcalendar as Record<string, string> | undefined)?.["WR-TIMEZONE"];
  const timezone = configuredTimezone === "auto" ? feedTimezone ?? "America/New_York" : configuredTimezone;

  const { start: startOfDay, end: endOfDay } = dayBounds(new Date(), timezone);

  const events: CalendarEvent[] = [];

  for (const key in data) {
    const item = data[key];
    if (!item || item.type !== "VEVENT") continue;
    const event = item as VEvent;

    if (event.rrule) {
      for (const occurrence of event.rrule.between(startOfDay, endOfDay, true)) {
        events.push({ summary: summaryText(event.summary), start: occurrence });
      }
    } else if (event.start >= startOfDay && event.start < endOfDay) {
      events.push({ summary: summaryText(event.summary), start: event.start });
    }
  }

  events.sort((a, b) => a.start.getTime() - b.start.getTime());
  return { events, timezone };
}

export function formatEvents(result: CalendarResult): string {
  if (result.events.length === 0) {
    return "Nothing on the calendar today.";
  }
  return result.events
    .map((e) => {
      const time = e.start.toLocaleTimeString("en-US", {
        timeZone: result.timezone,
        hour: "numeric",
        minute: "2-digit",
      });
      return `- ${time} ${e.summary}`;
    })
    .join("\n");
}
