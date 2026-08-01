import type { NavVisibility } from "../config.js";
import type { ClassFolder } from "../drive/classFolders.js";
import type { Reminder } from "../google/tasks.js";
import type { ReminderNotification } from "../reminders/notifications.js";
import { escapeHtml } from "../util/html.js";
import { toLocalDateTimeParts, withTimeSuffix } from "../util/time.js";
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

function renderClassSelect(classFolders: ClassFolder[], selectedClassId?: number): string {
  const options = classFolders
    .map(
      (c) =>
        `<option value="${c.id}" ${selectedClassId === c.id ? "selected" : ""}>${escapeHtml(c.className)}</option>`
    )
    .join("");
  return `
    <select name="classId">
      <option value="">No class</option>
      ${options}
    </select>`;
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
        <span class="reminder-title">${escapeHtml(withTimeSuffix(r.title, null))}</span>
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
  editingClassId?: number | null;
  notifications: Map<string, ReminderNotification>;
  classFolders: ClassFolder[];
  classLinks: Map<string, number>;
  navVisibility: NavVisibility;
}

function renderAddForm(classFolders: ClassFolder[]): string {
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
      ${classFolders.length > 0 ? renderClassSelect(classFolders) : ""}
      <div class="hint">Set a time and Donna will text you a reminder then, not just show the due date.</div>
      <textarea name="notes" placeholder="Notes (optional)"></textarea>
      <button class="btn" type="submit">Add</button>
    </form>`;
}

function renderEditForm(
  r: Reminder,
  timezone: string,
  notification: ReminderNotification | null | undefined,
  classFolders: ClassFolder[],
  editingClassId: number | null | undefined
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
        <input type="text" id="edit-title" name="title" value="${escapeHtml(withTimeSuffix(r.title, null))}" required />
      </div>

      <div class="reminder-add-row2">
        <input type="date" name="dueDate" value="${escapeHtml(parts.date)}" />
        <input type="time" name="dueTime" value="${escapeHtml(timeValue)}" />
      </div>
      ${classFolders.length > 0 ? renderClassSelect(classFolders, editingClassId ?? undefined) : ""}
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

// Groups reminders by linked class (in classFolders order), with an
// "Other" section for anything unlinked — only bothers with the grouped
// layout at all once at least one class exists, otherwise it's just
// noise for a plain reminder list.
function renderGroupedReminders(
  reminders: Reminder[],
  timezone: string,
  notifications: Map<string, ReminderNotification>,
  classFolders: ClassFolder[],
  classLinks: Map<string, number>
): string {
  if (classFolders.length === 0) {
    return reminders.map((r) => renderReminderRow(r, timezone, notifications)).join("\n");
  }

  const groups = classFolders.map((c) => ({
    label: c.className,
    reminders: reminders.filter((r) => classLinks.get(r.id) === c.id),
  }));
  const otherReminders = reminders.filter((r) => !classLinks.has(r.id));
  if (otherReminders.length > 0) {
    groups.push({ label: "Other", reminders: otherReminders });
  }

  return groups
    .map(
      (g) => `
    <div class="reminder-group">
      <div class="reminder-group-label">${escapeHtml(g.label)}</div>
      ${
        g.reminders.length === 0
          ? `<p class="empty">No deadlines.</p>`
          : g.reminders.map((r) => renderReminderRow(r, timezone, notifications)).join("\n")
      }
    </div>`
    )
    .join("\n");
}

export function buildRemindersHtml(data: RemindersPageData): string {
  const {
    reminders,
    googleConfigured,
    timezone,
    error,
    editing,
    editingNotification,
    editingClassId,
    notifications,
    classFolders,
    classLinks,
    navVisibility,
  } = data;

  let body: string;

  if (editing) {
    body = `
      <div class="section">
        <h1 class="page-title">Edit reminder</h1>
      </div>
      <div class="card">
        ${renderEditForm(editing, timezone, editingNotification, classFolders, editingClassId)}
      </div>`;
  } else {
    const listHtml = !googleConfigured
      ? `<p class="empty">Not connected yet — finish Google setup in Settings to use reminders.</p>`
      : reminders.length === 0
        ? `<p class="empty">No reminders. Nice.</p>`
        : renderGroupedReminders(reminders, timezone, notifications, classFolders, classLinks);

    body = `
      <div class="section">
        <h1 class="page-title">Reminders</h1>
        <p class="page-sub">${reminders.length} open</p>
      </div>
      ${error ? `<p class="hint" style="color:var(--danger);margin-bottom:16px;">${escapeHtml(error)}</p>` : ""}
      <div class="card">
        ${listHtml}
        ${googleConfigured ? renderAddForm(classFolders) : ""}
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
