import type { CalendarEvent } from "../calendar.js";
import type { NavVisibility } from "../config.js";
import { escapeHtml } from "../util/html.js";
import { renderLayout } from "./layout.js";

export interface CalendarDayGroup {
  dateLabel: string;
  events: CalendarEvent[];
  isToday: boolean;
}

export interface CalendarPageData {
  days: CalendarDayGroup[];
  timezone: string;
  configured: boolean;
  navVisibility: NavVisibility;
}

function formatEventTime(iso: string | Date, timezone: string): string {
  const date = iso instanceof Date ? iso : new Date(iso);
  return date.toLocaleTimeString("en-US", { timeZone: timezone, hour: "numeric", minute: "2-digit" });
}

function renderDayGroup(day: CalendarDayGroup, timezone: string): string {
  const eventsHtml = day.events.length
    ? day.events
        .map((e) => {
          const timeLabel = e.end
            ? `${formatEventTime(e.start, timezone)} – ${formatEventTime(e.end, timezone)}`
            : formatEventTime(e.start, timezone);
          const detail = e.location
            ? `<div class="agenda-event-detail">${escapeHtml(e.location)}</div>`
            : "";
          return `
            <div class="agenda-event-row">
              <div class="agenda-event-time">${escapeHtml(timeLabel)}</div>
              <div>
                <div class="agenda-event-title">${escapeHtml(e.summary)}</div>
                ${detail}
              </div>
            </div>`;
        })
        .join("\n")
    : `<p class="empty">Nothing scheduled.</p>`;

  return `
    <div class="agenda-day-group${day.isToday ? " agenda-day-group-today" : ""}">
      <div class="agenda-day-header${day.isToday ? " agenda-day-header-today" : ""}">${escapeHtml(day.dateLabel)}${day.isToday ? `<span class="agenda-today-badge">Today</span>` : ""}</div>
      ${eventsHtml}
    </div>`;
}

export function buildCalendarHtml(data: CalendarPageData): string {
  const { days, timezone, configured, navVisibility } = data;

  const body = `
    <div class="section">
      <h1 class="page-title">Calendar</h1>
      <p class="page-sub">Next 14 days</p>
    </div>
    ${
      configured
        ? days.map((d) => renderDayGroup(d, timezone)).join("\n")
        : `<p class="empty">Calendar isn't connected yet — set GOOGLE_CALENDAR_ICS_URL to see your schedule here.</p>`
    }`;

  return renderLayout({
    title: "Donna Calendar",
    activeTab: "calendar",
    bodyHtml: body,
    showChatFab: true,
    navVisibility,
  });
}
