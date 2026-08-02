import { getEventsInRange, type CalendarEvent } from "./calendar.js";
import { listRemindersSafe, type Reminder } from "./google/tasks.js";
import { escapeHtml } from "./util/html.js";
import { dayBounds, localDateKey } from "./util/time.js";
import type { BriefMessage } from "./formatBrief.js";

function formatTime(date: Date, timeZone: string): string {
  return date.toLocaleTimeString("en-US", { timeZone, hour: "numeric", minute: "2-digit" });
}

function formatWeekRange(start: Date, end: Date, timeZone: string): string {
  const fmt = new Intl.DateTimeFormat("en-US", { timeZone, month: "short", day: "numeric" });
  const lastDay = new Date(end.getTime() - 24 * 60 * 60 * 1000);
  return `${fmt.format(start)} – ${fmt.format(lastDay)}`;
}

function groupEventsByDay(events: CalendarEvent[], timeZone: string): Map<string, CalendarEvent[]> {
  const groups = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const key = localDateKey(event.start, timeZone);
    const list = groups.get(key);
    if (list) {
      list.push(event);
    } else {
      groups.set(key, [event]);
    }
  }
  return groups;
}

function formatCalendarSection(events: CalendarEvent[], timeZone: string): string {
  if (events.length === 0) return "Nothing on the calendar this week.";
  const groups = groupEventsByDay(events, timeZone);
  const dayFmt = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short", month: "short", day: "numeric" });
  const lines: string[] = [];
  for (const [, dayEvents] of [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    lines.push(`<b>${dayFmt.format(dayEvents[0].start)}</b>`);
    for (const e of dayEvents) {
      lines.push(`${formatTime(e.start, timeZone)} — ${escapeHtml(e.summary)}`);
    }
  }
  return lines.join("\n");
}

function formatRemindersSection(reminders: Reminder[], rangeStart: Date, rangeEnd: Date): string {
  const dueThisWeek = reminders
    .filter((r): r is Reminder & { due: string } => Boolean(r.due))
    .map((r) => ({ ...r, dueDate: new Date(r.due) }))
    .filter((r) => r.dueDate >= rangeStart && r.dueDate < rangeEnd)
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

  if (dueThisWeek.length === 0) return "Nothing due this week.";
  return dueThisWeek.map((r) => `• ${escapeHtml(r.title)}`).join("\n");
}

// A "week ahead" recap, sent alongside the regular daily brief once a week
// (see formatBrief.ts) rather than on its own cron — Vercel Hobby's cron
// limitations make a second scheduled trigger not worth it when folding a
// day-of-week check into the existing daily run works just as well.
export async function buildWeeklyDigestMessages(timezone: string): Promise<BriefMessage[]> {
  const rangeStart = dayBounds(new Date(), timezone).start;
  const rangeEnd = new Date(rangeStart.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [{ events }, reminders] = await Promise.all([
    getEventsInRange(timezone, rangeStart, rangeEnd),
    listRemindersSafe(),
  ]);

  const blocks = [
    `<b>Week ahead (${formatWeekRange(rangeStart, rangeEnd, timezone)})</b>`,
    `<b>Calendar</b>\n${formatCalendarSection(events, timezone)}`,
    `<b>Reminders due</b>\n${formatRemindersSection(reminders, rangeStart, rangeEnd)}`,
  ];

  return [{ text: blocks.join("\n\n"), parseMode: "HTML" }];
}
