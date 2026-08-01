import type { Reminder } from "../google/tasks.js";
import { escapeHtml } from "../util/html.js";
import { toLocalDateTimeParts } from "../util/time.js";
import { renderLayout } from "./layout.js";

function formatDue(dueIso: string, timezone: string): string {
  const { time } = toLocalDateTimeParts(dueIso, timezone);
  const date = new Date(dueIso);
  const datePart = date.toLocaleDateString("en-US", { timeZone: timezone, month: "short", day: "numeric" });
  // A due value we ourselves stored at exactly midnight means no specific
  // time was set (see localDateTimeToIso's "00:00" default) — show just
  // the date rather than an artificial "12:00 AM".
  return time === "00:00" ? datePart : `${datePart}, ${formatTime(dueIso, timezone)}`;
}

function formatTime(iso: string, timezone: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { timeZone: timezone, hour: "numeric", minute: "2-digit" });
}

function renderReminderRow(r: Reminder, timezone: string): string {
  const dueDate = r.due ? new Date(r.due) : null;
  const overdue = dueDate ? dueDate.getTime() < Date.now() : false;
  const isToday = dueDate ? new Date().toDateString() === dueDate.toDateString() : false;

  const rowClass = overdue ? "reminder-row-overdue" : isToday ? "reminder-row-today" : "";
  const dueBadge = r.due
    ? `<span class="reminder-due${overdue ? " reminder-due-overdue" : ""}">${escapeHtml(formatDue(r.due, timezone))}</span>`
    : "";

  return `
    <div class="reminder-row ${rowClass}">
      <form method="POST" action="/donna/reminders" style="display:contents;">
        <input type="hidden" name="action" value="complete" />
        <input type="hidden" name="id" value="${escapeHtml(r.id)}" />
        <input type="checkbox" onchange="this.form.requestSubmit()" aria-label="Mark done" />
      </form>
      <div class="reminder-body">
        <span class="reminder-title">${escapeHtml(r.title)}</span>
        ${dueBadge}
      </div>
      <a class="reminder-edit-link" href="/donna/reminders?edit=${encodeURIComponent(r.id)}">Edit</a>
    </div>`;
}

export interface RemindersPageData {
  reminders: Reminder[];
  googleConfigured: boolean;
  timezone: string;
  error?: string;
  editing?: Reminder | null;
}

function renderAddForm(): string {
  return `
    <form method="POST" action="/donna/reminders" class="reminder-add-form">
      <input type="hidden" name="action" value="add" />
      <input type="text" name="title" placeholder="Add a reminder…" required />
      <div class="reminder-add-row2">
        <input type="date" name="dueDate" id="reminder-due-date" />
        <input type="time" name="dueTime" id="reminder-due-time" />
        <button type="button" class="btn-secondary btn-small" onclick="setQuickDate(0)">Today</button>
        <button type="button" class="btn-secondary btn-small" onclick="setQuickDate(1)">Tomorrow</button>
      </div>
      <textarea name="notes" placeholder="Notes (optional)"></textarea>
      <button class="btn" type="submit">Add</button>
    </form>`;
}

function renderEditForm(r: Reminder, timezone: string): string {
  const { date, time } = r.due ? toLocalDateTimeParts(r.due, timezone) : { date: "", time: "" };

  return `
    <form method="POST" action="/donna/reminders" class="reminder-edit-form">
      <input type="hidden" name="action" value="update" />
      <input type="hidden" name="id" value="${escapeHtml(r.id)}" />

      <div class="field">
        <label for="edit-title">Title</label>
        <input type="text" id="edit-title" name="title" value="${escapeHtml(r.title)}" required />
      </div>

      <div class="reminder-add-row2">
        <input type="date" name="dueDate" value="${escapeHtml(date)}" />
        <input type="time" name="dueTime" value="${escapeHtml(time === "00:00" ? "" : time)}" />
      </div>

      <div class="field">
        <label for="edit-notes">Notes</label>
        <textarea id="edit-notes" name="notes">${escapeHtml(r.notes ?? "")}</textarea>
      </div>

      <div class="reminder-edit-actions">
        <button class="btn" type="submit">Save</button>
        <a class="btn btn-secondary" href="/donna/reminders">Cancel</a>
      </div>
    </form>
    <form method="POST" action="/donna/reminders" style="margin-top: 8px;">
      <input type="hidden" name="action" value="delete" />
      <input type="hidden" name="id" value="${escapeHtml(r.id)}" />
      <button class="btn btn-danger" type="submit">Delete reminder</button>
    </form>`;
}

export function buildRemindersHtml(data: RemindersPageData): string {
  const { reminders, googleConfigured, timezone, error, editing } = data;

  let body: string;

  if (editing) {
    body = `
      <div class="section">
        <h1 class="page-title">Edit reminder</h1>
      </div>
      <div class="card">
        ${renderEditForm(editing, timezone)}
      </div>`;
  } else {
    const listHtml = !googleConfigured
      ? `<p class="empty">Not connected yet — finish Google setup in Settings to use reminders.</p>`
      : reminders.length === 0
        ? `<p class="empty">No reminders. Nice.</p>`
        : reminders.map((r) => renderReminderRow(r, timezone)).join("\n");

    body = `
      <div class="section">
        <h1 class="page-title">Reminders</h1>
        <p class="page-sub">${reminders.length} open</p>
      </div>
      ${error ? `<p class="hint" style="color:var(--danger);margin-bottom:16px;">${escapeHtml(error)}</p>` : ""}
      <div class="card">
        ${listHtml}
        ${googleConfigured ? renderAddForm() : ""}
      </div>`;
  }

  return renderLayout({
    title: "Donna Reminders",
    activeTab: "reminders",
    bodyHtml: body,
    pageScript: CLIENT_SCRIPT,
    showChatFab: true,
  });
}

const CLIENT_SCRIPT = `
  function setQuickDate(daysFromNow) {
    const d = new Date();
    d.setDate(d.getDate() + daysFromNow);
    const iso = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    const input = document.getElementById("reminder-due-date");
    if (input) input.value = iso;
  }
`;
