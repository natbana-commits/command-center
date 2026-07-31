import ical from "node-ical";

export interface CalendarEvent {
  summary: string;
  start: Date;
}

// Computes midnight-to-midnight in America/New_York as absolute UTC instants,
// correctly handling DST — the server's own clock runs in UTC, which drifts
// from the Eastern calendar date for several hours each evening.
function easternDayBounds(now: Date): { start: Date; end: Date } {
  const dateParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
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
    timeZone: "America/New_York",
    timeZoneName: "shortOffset",
  })
    .formatToParts(now)
    .find((part) => part.type === "timeZoneName")!.value; // e.g. "GMT-4"

  const offsetHours = parseInt(offsetName.replace("GMT", ""), 10);
  const sign = offsetHours >= 0 ? "+" : "-";
  const offset = `${sign}${String(Math.abs(offsetHours)).padStart(2, "0")}:00`;

  const start = new Date(`${dateParts.year}-${dateParts.month}-${dateParts.day}T00:00:00${offset}`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

export async function getTodaysEvents(): Promise<CalendarEvent[]> {
  const url = process.env.GOOGLE_CALENDAR_ICS_URL;
  if (!url) {
    throw new Error("Missing GOOGLE_CALENDAR_ICS_URL in environment");
  }

  const data = await ical.async.fromURL(url);
  const { start: startOfDay, end: endOfDay } = easternDayBounds(new Date());

  const events: CalendarEvent[] = [];

  for (const key in data) {
    const item = data[key];
    if (item.type !== "VEVENT") continue;

    if (item.rrule) {
      for (const occurrence of item.rrule.between(startOfDay, endOfDay, true)) {
        events.push({ summary: item.summary, start: occurrence });
      }
    } else if (item.start >= startOfDay && item.start < endOfDay) {
      events.push({ summary: item.summary, start: item.start });
    }
  }

  events.sort((a, b) => a.start.getTime() - b.start.getTime());
  return events;
}

export function formatEvents(events: CalendarEvent[]): string {
  if (events.length === 0) {
    return "Nothing on the calendar today.";
  }
  return events
    .map((e) => {
      const time = e.start.toLocaleTimeString("en-US", {
        timeZone: "America/New_York",
        hour: "numeric",
        minute: "2-digit",
      });
      return `- ${time} ${e.summary}`;
    })
    .join("\n");
}
