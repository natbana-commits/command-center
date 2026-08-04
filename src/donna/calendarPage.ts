import type { CalendarEvent } from "../calendar.js";
import type { NavVisibility } from "../config.js";
import { escapeHtml } from "../util/html.js";
import { renderLayout } from "./layout.js";

export interface CalendarDayGroup {
  dateLabel: string;
  dateKey: string;
  events: CalendarEvent[];
  isToday: boolean;
}

export interface CalendarPageData {
  days: CalendarDayGroup[];
  weekLabel: string;
  weekOffset: number;
  timezone: string;
  configured: boolean;
  navVisibility: NavVisibility;
  navOrder: string[];
}

function formatEventTime(iso: string | Date, timezone: string): string {
  const date = iso instanceof Date ? iso : new Date(iso);
  return date.toLocaleTimeString("en-US", { timeZone: timezone, hour: "numeric", minute: "2-digit" });
}

function renderEventBlock(e: CalendarEvent, timezone: string): string {
  const timeLabel = formatEventTime(e.start, timezone);
  return `
    <div class="cal-event-block" title="${escapeHtml(e.summary)}${e.location ? ` — ${escapeHtml(e.location)}` : ""}">
      <span class="cal-event-time">${escapeHtml(timeLabel)}</span>
      <span class="cal-event-title">${escapeHtml(e.summary)}</span>
    </div>`;
}

function renderDayColumn(day: CalendarDayGroup, timezone: string): string {
  // Parsed at noon (rather than midnight) purely as a safety margin against
  // a server/target-timezone offset nudging the date — same pattern this
  // codebase already uses for other pre-resolved local date keys (e.g. the
  // Econ events widget, IPOs page).
  const asDate = new Date(`${day.dateKey}T12:00:00`);
  const weekdayAbbr = asDate.toLocaleDateString("en-US", { weekday: "short" });
  const dayNum = asDate.toLocaleDateString("en-US", { day: "numeric" });
  const eventsHtml = day.events.length
    ? day.events
        // Grid columns are narrow — chronological order matters more here
        // than in the old flat list, where events already arrived pre-sorted
        // per day from the ICS feed in practice but were never relied on to be.
        .slice()
        .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
        .map((e) => renderEventBlock(e, timezone))
        .join("\n")
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

export function buildCalendarHtml(data: CalendarPageData): string {
  const { days, weekLabel, weekOffset, timezone, configured, navVisibility, navOrder } = data;

  const body = `
    <div class="section">
      <h1 class="page-title">Calendar</h1>
      <p class="page-sub">Week view — day and month views are next up</p>
    </div>
    ${
      configured
        ? `
    <div class="cal-week-nav">
      <a class="btn-secondary btn-small" href="/donna/calendar?week=${weekOffset - 1}">← Prev</a>
      <div style="display:flex; align-items:center; gap: var(--sp-2);">
        <span class="section-title" style="margin:0;">${escapeHtml(weekLabel)}</span>
        ${weekOffset !== 0 ? `<a class="hint" href="/donna/calendar">This week</a>` : ""}
      </div>
      <a class="btn-secondary btn-small" href="/donna/calendar?week=${weekOffset + 1}">Next →</a>
    </div>
    <div class="cal-week-grid">
      ${days.map((d) => renderDayColumn(d, timezone)).join("\n")}
    </div>`
        : `<p class="empty">Calendar isn't connected yet — set GOOGLE_CALENDAR_ICS_URL to see your schedule here.</p>`
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
