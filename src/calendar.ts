import ical, { type VEvent } from "node-ical";
import { escapeHtml } from "./util/html.js";
import { dayBounds } from "./util/time.js";

function paramText(value: VEvent["summary"] | undefined): string | undefined {
  if (value === undefined) return undefined;
  return typeof value === "string" ? value : value.val;
}

export interface CalendarEvent {
  summary: string;
  start: Date;
  end?: Date;
  location?: string;
  description?: string;
}

export interface CalendarResult {
  events: CalendarEvent[];
  timezone: string;
}

async function fetchIcsData() {
  const url = process.env.GOOGLE_CALENDAR_ICS_URL;
  if (!url) {
    throw new Error("Missing GOOGLE_CALENDAR_ICS_URL in environment");
  }
  return ical.async.fromURL(url);
}

// "auto" follows the calendar's own configured timezone (Google includes
// this in every feed as WR-TIMEZONE); anything else is a manual override.
function resolveTimezone(data: Awaited<ReturnType<typeof fetchIcsData>>, configuredTimezone: string): string {
  const feedTimezone = (data.vcalendar as Record<string, string> | undefined)?.["WR-TIMEZONE"];
  return configuredTimezone === "auto" ? feedTimezone ?? "America/New_York" : configuredTimezone;
}

function extractEventsInRange(
  data: Awaited<ReturnType<typeof fetchIcsData>>,
  rangeStart: Date,
  rangeEnd: Date
): CalendarEvent[] {
  const events: CalendarEvent[] = [];

  for (const key in data) {
    const item = data[key];
    if (!item || item.type !== "VEVENT") continue;
    const event = item as VEvent;

    const duration = event.end ? event.end.getTime() - event.start.getTime() : undefined;
    const location = paramText(event.location);
    const description = paramText(event.description);

    if (event.rrule) {
      for (const occurrence of event.rrule.between(rangeStart, rangeEnd, true)) {
        events.push({
          summary: paramText(event.summary) ?? "",
          start: occurrence,
          end: duration !== undefined ? new Date(occurrence.getTime() + duration) : undefined,
          location,
          description,
        });
      }
    } else if (event.start >= rangeStart && event.start < rangeEnd) {
      events.push({
        summary: paramText(event.summary) ?? "",
        start: event.start,
        end: event.end,
        location,
        description,
      });
    }
  }

  events.sort((a, b) => a.start.getTime() - b.start.getTime());
  return events;
}

export async function getEventsInRange(
  configuredTimezone: string,
  rangeStart: Date,
  rangeEnd: Date
): Promise<CalendarResult> {
  const data = await fetchIcsData();
  const timezone = resolveTimezone(data, configuredTimezone);
  const events = extractEventsInRange(data, rangeStart, rangeEnd);
  return { events, timezone };
}

export async function getTodaysEvents(configuredTimezone: string): Promise<CalendarResult> {
  const data = await fetchIcsData();
  const timezone = resolveTimezone(data, configuredTimezone);
  const { start, end } = dayBounds(new Date(), timezone);
  const events = extractEventsInRange(data, start, end);
  return { events, timezone };
}

function formatTime(date: Date, timeZone: string): string {
  return date.toLocaleTimeString("en-US", { timeZone, hour: "numeric", minute: "2-digit" });
}

export function formatEvents(result: CalendarResult): string {
  if (result.events.length === 0) {
    return "Nothing on the calendar today.";
  }
  return result.events
    .map((e) => {
      const timeLabel = e.end
        ? `${formatTime(e.start, result.timezone)} – ${formatTime(e.end, result.timezone)}`
        : formatTime(e.start, result.timezone);

      const lines = [`<b>${timeLabel}</b>  ${escapeHtml(e.summary)}`];
      if (e.location) {
        lines.push(`Location: ${escapeHtml(e.location)}`);
      }
      if (e.description) {
        const truncated =
          e.description.length > 200 ? `${e.description.slice(0, 200).trim()}…` : e.description;
        lines.push(escapeHtml(truncated));
      }
      return lines.join("\n");
    })
    .join("\n\n");
}
