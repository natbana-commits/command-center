import type { NavVisibility } from "../config.js";
import type { Reminder } from "../google/tasks.js";
import type { ReminderNotification } from "../reminders/notifications.js";
import { escapeHtml } from "../util/html.js";
import { toLocalDateTimeParts } from "../util/time.js";
import { renderLayout } from "./layout.js";

// Google's Tasks API silently discards the time-of-day on `due` (always
// stores/returns midnight UTC) — the reminder_notifications row is the only
// place a real due *time* exists, when one was set. Falls back to Google's
// (date-only) due field when no notification is pending for this task.
function effectiveDue(r: Reminder, notification: ReminderNotification | undefined): string | undefined {
  return notification?.notifyAt ?? r.due;
}

function hasTime(dueIso: string, timezone: string): boolean {
  return toLocalDateTimeParts(dueIso, timezone).time !== "00:00";
}

function formatDue(dueIso: string, timezone: string): string {
  const date = new Date(dueIso);
  const datePart = date.toLocaleDateString("en-US", { timeZone: timezone, month: "short", day: "numeric" });
  if (!hasTime(dueIso, timezone)) return datePart;
  const timePart = date.toLocaleTimeString("en-US", { timeZone: timezone, hour: "numeric", minute: "2-digit" });
  return `${datePart}, ${timePart}`;
}

function renderReminderRow(
  r: Reminder,
  timezone: string,
  notifications: Map<string, ReminderNotification>
): string {
  const due = effectiveDue(r, notifications.get(r.id));
  const dueDate = due ? new Date(due) : null;
  const overdue = dueDate ? dueDate.getTime() < Date.now() : false;
  const isToday = dueDate ? new Date().toDateString() === dueDate.toDateString() : false;

  const rowClass = overdue ? "reminder-row-overdue" : isToday ? "reminder-row-today" : "";
  const dueBadge = due
    ? `<span class="reminder-due${overdue ? " reminder-due-overdue" : ""}">${escapeHtml(formatDue(due, timezone))}</span>`
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
  editingNotification?: ReminderNotification | null;
  notifications: Map<string, ReminderNotification>;
  navVisibility: NavVisibility;
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
      <div class="hint">Set a time and Donna will text you a reminder then, not just show the due date.</div>
      <textarea name="notes" placeholder="Notes (optional)"></textarea>
      <button class="btn" type="submit">Add</button>
    </form>`;
}

function renderEditForm(
  r: Reminder,
  timezone: string,
  notification: ReminderNotification | null | undefined
): string {
  const due = effectiveDue(r, notification ?? undefined);
  const parts = due ? toLocalDateTimeParts(due, timezone) : { date: "", time: "" };
  const timeValue = due && hasTime(due, timezone) ? parts.time : "";

  return `
    <form method="POST" action="/donna/reminders" class="reminder-edit-form">
      <input type="hidden" name="action" value="update" />
      <input type="hidden" name="id" value="${escapeHtml(r.id)}" />

      <div class="field">
        <label for="edit-title">Title</label>
        <input type="text" id="edit-title" name="title" value="${escapeHtml(r.title)}" required />
      </div>

      <div class="reminder-add-row2">
        <input type="date" name="dueDate" value="${escapeHtml(parts.date)}" />
        <input type="time" name="dueTime" value="${escapeHtml(timeValue)}" />
      </div>
      <div class="hint">Set a time and Donna will text you a reminder then, not just show the due date.</div>

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
  const { reminders, googleConfigured, timezone, error, editing, editingNotification, notifications, navVisibility } = data;

  let body: string;

  if (editing) {
    body = `
      <div class="section">
        <h1 class="page-title">Edit reminder</h1>
      </div>
      <div class="card">
        ${renderEditForm(editing, timezone, editingNotification)}
      </div>`;
  } else {
    const listHtml = !googleConfigured
      ? `<p class="empty">Not connected yet — finish Google setup in Settings to use reminders.</p>`
      : reminders.length === 0
        ? `<p class="empty">No reminders. Nice.</p>`
        : reminders.map((r) => renderReminderRow(r, timezone, notifications)).join("\n");

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
    navVisibility,
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
