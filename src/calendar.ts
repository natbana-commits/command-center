import ical from "node-ical";

export interface CalendarEvent {
  summary: string;
  start: Date;
}

export async function getTodaysEvents(): Promise<CalendarEvent[]> {
  const url = process.env.GOOGLE_CALENDAR_ICS_URL;
  if (!url) {
    throw new Error("Missing GOOGLE_CALENDAR_ICS_URL in environment");
  }

  const data = await ical.async.fromURL(url);

  // Servers run in UTC and this job only ever fires at 7am ET (11:00 UTC),
  // which is already past UTC midnight on the same calendar date — so plain
  // UTC day boundaries line up with "today" in Eastern for this schedule.
  const now = new Date();
  const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

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
