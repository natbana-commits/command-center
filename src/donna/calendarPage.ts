import type { CalendarEvent } from "../calendar.js";
import type { NavVisibility } from "../config.js";
import type { Reminder } from "../google/tasks.js";
import type { ReminderNotification } from "../reminders/notifications.js";
import { escapeHtml } from "../util/html.js";
import { localDateKey, withTimeSuffix } from "../util/time.js";
import { renderLayout } from "./layout.js";
import { effectiveDue, hasTime } from "./remindersPage.js";
import { iconBell } from "./icons.js";
import { tileColorForSeed } from "./tileColor.js";

export type CalendarView = "day" | "week" | "month";

export interface CalendarDayGroup {
  dateLabel: string;
  dateKey: string;
  events: CalendarEvent[];
  isToday: boolean;
  // Month view only — dims cells that belong to the previous/next month
  // (the grid always shows full weeks, so the first/last row usually
  // spills over the month's actual boundaries).
  inCurrentMonth?: boolean;
}

export interface CalendarPageData {
  view: CalendarView;
  offset: number;
  headerLabel: string;
  days: CalendarDayGroup[];
  monthWeeks: CalendarDayGroup[][];
  timezone: string;
  configured: boolean;
  todayReminders: Reminder[];
  reminderNotifications: Map<string, ReminderNotification>;
  navVisibility: NavVisibility;
  navOrder: string[];
}

function formatEventTime(iso: string | Date, timezone: string): string {
  const date = iso instanceof Date ? iso : new Date(iso);
  return date.toLocaleTimeString("en-US", { timeZone: timezone, hour: "numeric", minute: "2-digit" });
}

function renderEventBlock(e: CalendarEvent, timezone: string): string {
  const timeLabel = e.end
    ? `${formatEventTime(e.start, timezone)} – ${formatEventTime(e.end, timezone)}`
    : formatEventTime(e.start, timezone);
  const locationHtml = e.location ? `<span class="cal-event-location">${escapeHtml(e.location)}</span>` : "";
  const { tint } = tileColorForSeed(e.summary);
  return `
    <div class="cal-event-block" style="--tint: ${tint};">
      <span class="cal-event-time">${escapeHtml(timeLabel)}</span>
      <span class="cal-event-title">${escapeHtml(e.summary)}</span>
      ${locationHtml}
    </div>`;
}

function sortedEvents(day: CalendarDayGroup): CalendarEvent[] {
  // Grid columns are narrow — chronological order matters more here than
  // in the old flat list, where events already arrived pre-sorted per day
  // from the ICS feed in practice but were never relied on to be.
  return day.events.slice().sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
}

function renderDayColumn(day: CalendarDayGroup, timezone: string): string {
  // Parsed at noon (rather than midnight) purely as a safety margin against
  // a server/target-timezone offset nudging the date — same pattern this
  // codebase already uses for other pre-resolved local date keys (e.g. the
  // Econ events widget, IPOs page).
  const asDate = new Date(`${day.dateKey}T12:00:00`);
  const weekdayAbbr = asDate.toLocaleDateString("en-US", { weekday: "short" });
  const dayNum = asDate.toLocaleDateString("en-US", { day: "numeric" });
  const events = sortedEvents(day);
  const eventsHtml = events.length
    ? events.map((e) => renderEventBlock(e, timezone)).join("\n")
    : `<p class="empty" style="font-size:12px;">Nothing scheduled.</p>`;

  return `
    <div class="cal-day-col${day.isToday ? " cal-day-col-today" : ""}">
      <div class="cal-day-header">
        <span class="cal-day-name">${escapeHtml(weekdayAbbr)}</span>
        <span class="cal-day-num${day.isToday ? " cal-day-num-today" : ""}">${escapeHtml(dayNum)}</span>
      </div>
      <div class="cal-day-events">
        ${eventsHtml}
      </div>
    </div>`;
}

const MONTH_WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MAX_MONTH_CHIPS = 3;

function renderMonthCell(day: CalendarDayGroup): string {
  const asDate = new Date(`${day.dateKey}T12:00:00`);
  const dayNum = asDate.toLocaleDateString("en-US", { day: "numeric" });
  const events = sortedEvents(day);
  const chips = events
    .slice(0, MAX_MONTH_CHIPS)
    .map((e) => `<span class="cal-month-chip" style="--tint: ${tileColorForSeed(e.summary).tint};">${escapeHtml(e.summary)}</span>`)
    .join("\n");
  const more = events.length > MAX_MONTH_CHIPS ? `<span class="cal-month-more">+${events.length - MAX_MONTH_CHIPS} more</span>` : "";

  return `
    <a class="cal-month-cell${day.inCurrentMonth === false ? " cal-month-cell-outside" : ""}" href="/donna/calendar?view=day&date=${escapeHtml(day.dateKey)}">
      <span class="cal-month-daynum${day.isToday ? " cal-month-daynum-today" : ""}">${escapeHtml(dayNum)}</span>
      ${chips}
      ${more}
    </a>`;
}

function renderMonthGrid(weeks: CalendarDayGroup[][]): string {
  const weekdayHeaders = MONTH_WEEKDAY_LABELS.map((d) => `<div class="cal-month-weekday">${d}</div>`).join("\n");
  const cells = weeks.flat().map(renderMonthCell).join("\n");
  return `
    <div class="cal-month-grid">
      ${weekdayHeaders}
      ${cells}
    </div>`;
}

function renderTodayReminders(reminders: Reminder[], notifications: Map<string, ReminderNotification>, timezone: string): string {
  const todayKey = localDateKey(new Date(), timezone);
  const todays = reminders
    .map((r) => ({ r, due: effectiveDue(r, notifications.get(r.id)) }))
    .filter((x): x is { r: Reminder; due: string } => Boolean(x.due) && localDateKey(new Date(x.due!), timezone) === todayKey)
    .sort((a, b) => new Date(a.due).getTime() - new Date(b.due).getTime());

  return `
    <div class="section" style="margin-top: var(--sp-3);">
      <div class="fw-tile-head">
        <div class="fw-icon" style="--accent: var(--hw-reminders);">${iconBell}</div>
        <h1 class="section-title" style="margin:0;">Today's Reminders</h1>
      </div>
      ${
        todays.length === 0
          ? `<p class="empty">Nothing due today.</p>`
          : `<div class="card" style="background-image: linear-gradient(135deg, var(--hw-reminders-tint) 0%, var(--card) 45%);">
              ${todays
                .map(
                  ({ r, due }) => `
                <div class="agenda-event-row">
                  <span class="agenda-event-time">${escapeHtml(hasTime(due, timezone) ? new Date(due).toLocaleTimeString("en-US", { timeZone: timezone, hour: "numeric", minute: "2-digit" }) : "All day")}</span>
                  <span class="agenda-event-title">${escapeHtml(withTimeSuffix(r.title, null))}</span>
                </div>`
                )
                .join("\n")}
            </div>`
      }
    </div>`;
}

function renderViewToggle(view: CalendarView): string {
  const tabs: { key: CalendarView; label: string }[] = [
    { key: "day", label: "Day" },
    { key: "week", label: "Week" },
    { key: "month", label: "Month" },
  ];
  return `
    <div class="home-tabs">
      ${tabs
        .map(
          (t) =>
            `<a class="home-tab-btn${t.key === view ? " home-tab-btn-active" : ""}" href="/donna/calendar?view=${t.key}">${t.label}</a>`
        )
        .join("")}
    </div>`;
}

export function buildCalendarHtml(data: CalendarPageData): string {
  const { view, offset, headerLabel, days, monthWeeks, timezone, configured, todayReminders, reminderNotifications, navVisibility, navOrder } = data;

  const nav = (() => {
    if (view === "day") {
      return {
        prev: `?view=day&day=${offset - 1}`,
        next: `?view=day&day=${offset + 1}`,
        jump: "?view=day",
        self: `?view=day&day=${offset}`,
      };
    }
    if (view === "month") {
      return {
        prev: `?view=month&month=${offset - 1}`,
        next: `?view=month&month=${offset + 1}`,
        jump: "?view=month",
        self: `?view=month&month=${offset}`,
      };
    }
    return {
      prev: `?view=week&week=${offset - 1}`,
      next: `?view=week&week=${offset + 1}`,
      jump: "?view=week",
      self: `?view=week&week=${offset}`,
    };
  })();

  const gridHtml =
    view === "month"
      ? renderMonthGrid(monthWeeks)
      : view === "day"
        ? `<div class="cal-day-grid">${days.map((d) => renderDayColumn(d, timezone)).join("\n")}</div>`
        : `<div class="cal-week-grid">${days.map((d) => renderDayColumn(d, timezone)).join("\n")}</div>`;

  const body = `
    <div class="section">
      <h1 class="page-title">Calendar</h1>
    </div>
    ${renderViewToggle(view)}
    ${
      configured
        ? `
    <div class="cal-week-nav">
      <a class="btn-secondary btn-small" href="/donna/calendar${nav.prev}">← Prev</a>
      <div style="display:flex; align-items:center; gap: var(--sp-2);">
        <span class="section-title" style="margin:0;">${escapeHtml(headerLabel)}</span>
        ${offset !== 0 ? `<a class="hint" href="/donna/calendar${nav.jump}">Today</a>` : ""}
        <a class="hint" href="/donna/calendar${nav.self}&refresh=1" title="Re-check the calendar for anything added since the last load">Refresh</a>
      </div>
      <a class="btn-secondary btn-small" href="/donna/calendar${nav.next}">Next →</a>
    </div>
    ${gridHtml}
    ${renderTodayReminders(todayReminders, reminderNotifications, timezone)}`
        : `<p class="empty">Calendar isn't connected yet. Set GOOGLE_CALENDAR_ICS_URL to see your schedule here.</p>`
    }`;

  return renderLayout({
    title: "Donna Calendar",
    activeTab: "calendar",
    bodyHtml: body,
    showChatFab: true,
    navVisibility,
    navOrder,
  });
}
