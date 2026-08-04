import type { VercelRequest, VercelResponse } from "@vercel/node";
import { loadSettings } from "../src/config.js";
import { resolveTimezone, dayBounds, localDateKey, localWeekdayIndex } from "../src/util/time.js";
import { getEventsInRange, type CalendarEvent } from "../src/calendar.js";
import { buildCalendarHtml, type CalendarDayGroup } from "../src/donna/calendarPage.js";
import { requireAuth } from "../src/auth/session.js";

const DAYS_PER_WEEK = 7;

// Steps a day at a time (rather than adding days*86400000ms in one shot)
// so each step re-resolves the timezone offset via dayBounds — the same
// self-correcting technique this file already used for its old rolling
// 14-day window, generalized here to also go backwards (negative `days`)
// for "previous week" navigation. A raw ms offset over a multi-day span
// can land on the wrong local date across a DST transition; this can't.
function addLocalDays(from: Date, days: number, timezone: string): Date {
  let cursor = from;
  const step = days >= 0 ? 1 : -1;
  for (let i = 0; i < Math.abs(days); i++) {
    const { start, end } = dayBounds(cursor, timezone);
    cursor = step > 0 ? new Date(end.getTime() + 1) : new Date(start.getTime() - 1);
  }
  return dayBounds(cursor, timezone).start;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!(await requireAuth(req, res))) return;

  const settings = await loadSettings();
  const timezone = resolveTimezone(settings.timezone);

  const parsedOffset = Number(req.query.week);
  const weekOffset = Number.isFinite(parsedOffset) ? Math.trunc(parsedOffset) : 0;

  const { start: todayStart } = dayBounds(new Date(), timezone);
  const todayKey = localDateKey(todayStart, timezone);
  const currentWeekSunday = addLocalDays(todayStart, -localWeekdayIndex(todayStart, timezone), timezone);
  const weekStart = addLocalDays(currentWeekSunday, weekOffset * DAYS_PER_WEEK, timezone);

  const dayStarts: Date[] = [];
  let cursor = weekStart;
  for (let i = 0; i < DAYS_PER_WEEK; i++) {
    dayStarts.push(cursor);
    const { end } = dayBounds(cursor, timezone);
    cursor = new Date(end.getTime() + 1);
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
    const dateKey = localDateKey(start, timezone);
    const dateLabel = start.toLocaleDateString("en-US", {
      timeZone: timezone,
      weekday: "long",
      month: "long",
      day: "numeric",
    });
    return { dateLabel, dateKey, events: dayEvents, isToday: dateKey === todayKey };
  });

  const weekLabel = `${dayStarts[0].toLocaleDateString("en-US", { timeZone: timezone, month: "short", day: "numeric" })} – ${dayStarts[6].toLocaleDateString("en-US", { timeZone: timezone, month: "short", day: "numeric" })}`;

  const html = buildCalendarHtml({
    days,
    weekLabel,
    weekOffset,
    timezone,
    configured,
    navVisibility: settings.dashboardConfig.navVisibility,
    navOrder: settings.dashboardConfig.navOrder,
  });
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
}
