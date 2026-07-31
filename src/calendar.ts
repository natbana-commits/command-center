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

    const duration = event.end ? event.end.getTime() - event.start.getTime() : undefined;
    const location = paramText(event.location);
    const description = paramText(event.description);

    if (event.rrule) {
      for (const occurrence of event.rrule.between(startOfDay, endOfDay, true)) {
        events.push({
          summary: paramText(event.summary) ?? "",
          start: occurrence,
          end: duration !== undefined ? new Date(occurrence.getTime() + duration) : undefined,
          location,
          description,
        });
      }
    } else if (event.start >= startOfDay && event.start < endOfDay) {
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
