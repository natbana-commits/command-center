import type { VercelRequest, VercelResponse } from "@vercel/node";
import { loadSettings } from "../src/config.js";
import { resolveTimezone, dayBounds } from "../src/util/time.js";
import { getEventsInRange, type CalendarEvent } from "../src/calendar.js";
import { buildCalendarHtml, type CalendarDayGroup } from "../src/donna/calendarPage.js";

const NUM_DAYS = 14;

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const settings = await loadSettings();
  const timezone = resolveTimezone(settings.timezone);

  const dayStarts: Date[] = [];
  let cursor = new Date();
  for (let i = 0; i < NUM_DAYS; i++) {
    const { start } = dayBounds(cursor, timezone);
    dayStarts.push(start);
    cursor = new Date(start.getTime() + 24 * 60 * 60 * 1000 + 1);
  }

  const rangeStart = dayStarts[0];
  const rangeEnd = new Date(dayStarts[dayStarts.length - 1].getTime() + 24 * 60 * 60 * 1000);

  let events: CalendarEvent[] = [];
  let configured = true;
  try {
    const result = await getEventsInRange(timezone, rangeStart, rangeEnd);
    events = result.events;
  } catch (err) {
    configured = false;
  }

  const days: CalendarDayGroup[] = dayStarts.map((start, i) => {
    const nextStart = dayStarts[i + 1] ?? new Date(start.getTime() + 24 * 60 * 60 * 1000);
    const dayEvents = events.filter((e) => e.start >= start && e.start < nextStart);
    const dateLabel = start.toLocaleDateString("en-US", {
      timeZone: timezone,
      weekday: "long",
      month: "long",
      day: "numeric",
    });
    return { dateLabel, events: dayEvents, isToday: i === 0 };
  });

  const html = buildCalendarHtml({
    days,
    timezone,
    configured,
    navVisibility: settings.dashboardConfig.navVisibility,
    navOrder: settings.dashboardConfig.navOrder,
  });
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
}
