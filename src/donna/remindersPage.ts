import type { NavVisibility } from "../config.js";
import type { ClassFolder } from "../drive/classFolders.js";
import type { Reminder } from "../google/tasks.js";
import type { ReminderNotification } from "../reminders/notifications.js";
import type { ReminderGroup } from "../reminders/groups.js";
import type { Habit } from "../habits/store.js";
import type { Birthday } from "../reminders/birthdays.js";
import { tileColorForSeed } from "./tileColor.js";
import { computeStreak } from "../habits/store.js";
import { escapeHtml } from "../util/html.js";
import { toLocalDateTimeParts, withTimeSuffix, localDateKey } from "../util/time.js";
import { renderLayout } from "./layout.js";
import { renderDayBadge } from "./dayBadge.js";
import { renderPageEditLink } from "./editLink.js";

// Google's Tasks API silently discards the time-of-day on `due` (always
// stores/returns midnight UTC, representing a calendar date rather than a
// real instant) — the reminder_notifications row is the only place a real
// due *time* exists, when one was set. `dateOnly` tells every consumer
// below which of those two shapes `iso` is, since they must be read back
// completely differently: a real instant through the local timezone, a
// date-only value by taking its UTC calendar date directly. Converting a
// date-only value through the local timezone (as this used to do) shifts
// it a day whenever the zone's offset is negative, e.g. Google's midnight
// UTC for Aug 14 reads as Aug 13, 8pm in America/New_York.
export interface EffectiveDue {
  iso: string;
  dateOnly: boolean;
}

// Falls back to Google's (date-only) due field when no notification is
// pending for this task.
export function effectiveDue(r: Reminder, notification: ReminderNotification | undefined): EffectiveDue | undefined {
  if (notification) return { iso: notification.notifyAt, dateOnly: false };
  if (r.due) return { iso: r.due, dateOnly: true };
  return undefined;
}

export function hasTime(due: EffectiveDue): boolean {
  return !due.dateOnly;
}

// The UTC calendar date embedded in a date-only `due` IS the intended
// date regardless of timezone — no conversion needed (and converting
// through the local zone is exactly what produces the day-early bug).
export function dueDateKey(due: EffectiveDue, timezone: string): string {
  return due.dateOnly ? due.iso.slice(0, 10) : localDateKey(new Date(due.iso), timezone);
}

// Comparing raw `.iso` instants directly (as every "sort by due date" call
// site used to do) mixes two incompatible shapes: a date-only due's `.iso`
// is Google's zeroed midnight-UTC value, which in a negative-offset zone
// reads as evening of the *previous* local day — so a timed reminder due
// tonight at 9pm can sort AFTER tomorrow's all-day item. Comparing local
// calendar day first sidesteps that entirely; only within the same day do
// instants matter, and even then a date-only item (no specific time) sorts
// before any timed item that day rather than being compared as an instant.
export function compareByDue(a: EffectiveDue, b: EffectiveDue, timezone: string): number {
  const aKey = dueDateKey(a, timezone);
  const bKey = dueDateKey(b, timezone);
  if (aKey !== bKey) return aKey < bKey ? -1 : 1;
  const aHasTime = hasTime(a);
  const bHasTime = hasTime(b);
  if (aHasTime !== bHasTime) return aHasTime ? 1 : -1;
  if (!aHasTime) return 0;
  return new Date(a.iso).getTime() - new Date(b.iso).getTime();
}

export function formatDue(due: EffectiveDue, timezone: string): string {
  if (due.dateOnly) {
    const [y, m, d] = due.iso.slice(0, 10).split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric" });
  }
  const date = new Date(due.iso);
  const datePart = date.toLocaleDateString("en-US", { timeZone: timezone, month: "short", day: "numeric" });
  const timePart = date.toLocaleTimeString("en-US", { timeZone: timezone, hour: "numeric", minute: "2-digit" });
  return `${datePart}, ${timePart}`;
}

// Converts the gap between the due time and an early notification's time
// into the cleanest whole unit ("2d" / "3h" / "45m") for a compact hint.
function formatLeadTime(dueIso: string, earlyIso: string): string {
  const minutes = Math.round((new Date(dueIso).getTime() - new Date(earlyIso).getTime()) / 60000);
  if (minutes > 0 && minutes % 1440 === 0) return `${minutes / 1440}d`;
  if (minutes > 0 && minutes % 60 === 0) return `${minutes / 60}h`;
  return `${minutes}m`;
}

// Inverse of the above, for prefilling the edit form's lead-time fields
// from a stored early notification.
function leadTimeParts(dueIso: string, earlyIso: string): { value: number; unit: "minutes" | "hours" | "days" } {
  const minutes = Math.round((new Date(dueIso).getTime() - new Date(earlyIso).getTime()) / 60000);
  if (minutes > 0 && minutes % 1440 === 0) return { value: minutes / 1440, unit: "days" };
  if (minutes > 0 && minutes % 60 === 0) return { value: minutes / 60, unit: "hours" };
  return { value: minutes, unit: "minutes" };
}

// Reminders with no due date sort last — they're not time-sensitive, so
// they shouldn't crowd out what's actually coming up soonest.
function sortRemindersByDue(
  reminders: Reminder[],
  notifications: Map<string, ReminderNotification>,
  timezone: string
): Reminder[] {
  return [...reminders].sort((a, b) => {
    const dueA = effectiveDue(a, notifications.get(a.id));
    const dueB = effectiveDue(b, notifications.get(b.id));
    if (!dueA && !dueB) return 0;
    if (!dueA) return 1;
    if (!dueB) return -1;
    return compareByDue(dueA, dueB, timezone);
  });
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

function renderGroupSelect(groups: ReminderGroup[], selectedGroupId?: number): string {
  const options = groups
    .map((g) => `<option value="${g.id}" ${selectedGroupId === g.id ? "selected" : ""}>${escapeHtml(g.name)}</option>`)
    .join("");
  return `
    <select name="groupId">
      <option value="">No group</option>
      ${options}
    </select>`;
}

function renderEarlyLeadRow(current?: { value: number; unit: "minutes" | "hours" | "days" }): string {
  const value = current?.value ?? "";
  const unit = current?.unit ?? "minutes";
  return `
    <div class="reminder-add-row2">
      <label class="hint" style="margin:0;">Remind me earlier</label>
      <input type="number" name="earlyLeadValue" min="1" placeholder="e.g. 30" style="width:70px;" value="${value}" />
      <select name="earlyLeadUnit">
        <option value="minutes" ${unit === "minutes" ? "selected" : ""}>minutes before</option>
        <option value="hours" ${unit === "hours" ? "selected" : ""}>hours before</option>
        <option value="days" ${unit === "days" ? "selected" : ""}>days before</option>
      </select>
    </div>
    <div class="hint">Optional second text, this much before the due time (requires a time above).</div>`;
}

function renderReminderRow(
  r: Reminder,
  timezone: string,
  notifications: Map<string, ReminderNotification>,
  earlyNotifications: Map<string, ReminderNotification>,
  group: ReminderGroup | undefined
): string {
  const due = effectiveDue(r, notifications.get(r.id));

  const groupPill = group
    ? `<span class="day-badge-pill" style="color:${escapeHtml(group.color)}; background:${escapeHtml(group.color)}1a;">${escapeHtml(group.name)}</span>`
    : "";
  const dueHint = due ? `<span class="hint" style="margin:0;">${escapeHtml(formatDue(due, timezone))}</span>` : "";

  const early = earlyNotifications.get(r.id);
  const earlyHint =
    due && early ? `<span class="hint" style="margin:0;">+ texts ${formatLeadTime(due.iso, early.notifyAt)} early</span>` : "";

  // Groups already carry a real user-picked color (see the group pill
  // below) — reused here for the row's own tint so an item's color story
  // is consistent top to bottom, not two different color systems on one
  // row. Ungrouped reminders fall back to a hash-based color (same idea
  // as Home's palette) purely so a long ungrouped list doesn't read as
  // one flat color either.
  const tint = group ? `${group.color}1a` : tileColorForSeed(r.id).tint;
  const badgeColor = group?.color ?? tileColorForSeed(r.id).accent;

  return `
    <div class="reminder-row" style="background-image: linear-gradient(135deg, ${escapeHtml(tint)} 0%, var(--card) 65%);">
      <form method="POST" action="/donna/reminders" data-swap-target="reminders-main" style="display:contents;">
        <input type="hidden" name="action" value="complete" />
        <input type="hidden" name="id" value="${escapeHtml(r.id)}" />
        <input type="checkbox" onchange="this.closest('.reminder-row').classList.add('reminder-row-completing'); this.form.requestSubmit()" aria-label="Mark done" />
      </form>
      ${due ? renderDayBadge(dueDateKey(due, timezone), badgeColor, timezone) : ""}
      <div class="day-badge-body">
        ${groupPill}
        <div class="day-badge-title">${escapeHtml(withTimeSuffix(r.title, null))}</div>
        ${dueHint}
        ${earlyHint}
      </div>
      <div class="reminder-row-actions">
        <a class="reminder-edit-link" href="/donna/reminders?edit=${encodeURIComponent(r.id)}">Edit</a>
        <form method="POST" action="/donna/reminders" data-swap-target="reminders-main" style="display:contents;">
          <input type="hidden" name="action" value="delete" />
          <input type="hidden" name="id" value="${escapeHtml(r.id)}" />
          <button class="reminder-delete-link" type="submit" onclick="if(!confirm('Delete this reminder?'))return false; this.closest('.reminder-row').classList.add('reminder-row-completing'); return true;">Delete</button>
        </form>
      </div>
    </div>`;
}

function renderHabitRow(habit: Habit, completedToday: boolean, streak: number): string {
  const streakLabel = streak > 0 ? `${streak} day${streak === 1 ? "" : "s"} streak` : "No streak yet";
  const tint = tileColorForSeed(String(habit.id)).tint;
  return `
    <div class="reminder-row" style="background-image: linear-gradient(135deg, ${escapeHtml(tint)} 0%, var(--card) 65%);">
      <form method="POST" action="/donna/reminders" data-swap-target="reminders-main" style="display:contents;">
        <input type="hidden" name="action" value="toggle-habit" />
        <input type="hidden" name="id" value="${habit.id}" />
        <input type="checkbox" ${completedToday ? "checked" : ""} onchange="this.closest('.reminder-row').classList.toggle('reminder-row-completing', this.checked); this.form.requestSubmit()" aria-label="Mark done today" />
      </form>
      <div class="reminder-body">
        <span class="reminder-title">${escapeHtml(habit.title)}</span>
        <div class="interaction-meta">
          <span class="reminder-due">${streakLabel}</span>
          <span class="hint" style="margin:0;">Nudge at ${escapeHtml(habit.notifyTime)}</span>
        </div>
      </div>
      <form method="POST" action="/donna/reminders" data-swap-target="reminders-main" style="display:contents;">
        <input type="hidden" name="action" value="delete-habit" />
        <input type="hidden" name="id" value="${habit.id}" />
        <button class="reminder-edit-link" type="submit" style="background:none; border:none; cursor:pointer; font:inherit;">Delete</button>
      </form>
    </div>`;
}

function renderAddHabitForm(): string {
  return `
    <form method="POST" action="/donna/reminders" class="reminder-add-row2" data-swap-target="reminders-main" style="margin-top: var(--sp-2);">
      <input type="hidden" name="action" value="add-habit" />
      <input type="text" name="title" placeholder="New habit…" required style="flex: 1 1 160px;" />
      <label class="hint" style="margin:0;">Nudge at</label>
      <input type="time" name="notifyTime" value="20:00" required />
      <button class="btn btn-small" type="submit">Add</button>
    </form>`;
}

function renderHabitsSection(habits: Habit[], completions: Map<number, Set<string>>, todayKey: string): string {
  const rows =
    habits.length === 0
      ? `<p class="empty">No habits yet.</p>`
      : habits
          .map((h) => {
            const dates = completions.get(h.id) ?? new Set<string>();
            return renderHabitRow(h, dates.has(todayKey), computeStreak(dates, todayKey));
          })
          .join("\n");

  return `
    <div class="card" style="margin-top: var(--sp-3);">
      <div class="card-header"><h2 class="section-title" style="margin:0;">Habits</h2></div>
      ${rows}
      ${renderAddHabitForm()}
    </div>`;
}

function daysUntilNextOccurrence(month: number, day: number, timezone: string): number {
  const todayKey = localDateKey(new Date(), timezone);
  const [year] = todayKey.split("-").map(Number);
  const todayNoon = new Date(`${todayKey}T12:00:00`);
  const thisYear = new Date(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T12:00:00`);
  let diffDays = Math.round((thisYear.getTime() - todayNoon.getTime()) / 86_400_000);
  if (diffDays < 0) diffDays += 365;
  return diffDays;
}

function renderBirthdayRow(b: Birthday): string {
  const dateLabel = new Date(2000, b.month - 1, b.day).toLocaleDateString("en-US", { month: "long", day: "numeric" });
  const tint = tileColorForSeed(b.name).tint;
  return `
    <div class="reminder-row" style="background-image: linear-gradient(135deg, ${escapeHtml(tint)} 0%, var(--card) 65%);">
      <div class="reminder-body">
        <span class="reminder-title">${escapeHtml(b.name)}</span>
        <div class="interaction-meta">
          <span class="reminder-due">${escapeHtml(dateLabel)}</span>
        </div>
      </div>
      <form method="POST" action="/donna/reminders" data-swap-target="reminders-main" style="display:contents;">
        <input type="hidden" name="action" value="delete-birthday" />
        <input type="hidden" name="id" value="${b.id}" />
        <button class="reminder-edit-link" type="submit" style="background:none; border:none; cursor:pointer; font:inherit;">Delete</button>
      </form>
    </div>`;
}

function renderAddBirthdayForm(): string {
  return `
    <form method="POST" action="/donna/reminders" class="reminder-add-row2" data-swap-target="reminders-main" style="margin-top: var(--sp-2);">
      <input type="hidden" name="action" value="add-birthday" />
      <input type="text" name="name" placeholder="Name" required style="flex: 1 1 160px;" />
      <input type="date" name="birthDate" required />
      <button class="btn btn-small" type="submit">Add</button>
    </form>`;
}

function renderBirthdaysSection(birthdays: Birthday[], timezone: string): string {
  const sorted = [...birthdays].sort(
    (a, b) => daysUntilNextOccurrence(a.month, a.day, timezone) - daysUntilNextOccurrence(b.month, b.day, timezone)
  );
  const rows = sorted.length === 0 ? `<p class="empty">No birthdays saved yet.</p>` : sorted.map(renderBirthdayRow).join("\n");

  return `
    <div class="card" style="margin-top: var(--sp-3);">
      <div class="card-header"><h2 class="section-title" style="margin:0;">Birthdays</h2></div>
      ${rows}
      ${renderAddBirthdayForm()}
      <div class="hint" style="margin-top: var(--sp-2);">Adds a yearly reminder to your Google Calendar and gets called out in your morning text on the day.</div>
    </div>`;
}

export type ReminderSortMode = "due" | "group";

export interface RemindersPageData {
  reminders: Reminder[];
  googleConfigured: boolean;
  timezone: string;
  error?: string;
  editing?: Reminder | null;
  editingNotification?: ReminderNotification | null;
  editingEarlyNotification?: ReminderNotification | null;
  editingClassId?: number | null;
  editingGroupId?: number | null;
  notifications: Map<string, ReminderNotification>;
  earlyNotifications: Map<string, ReminderNotification>;
  classFolders: ClassFolder[];
  classLinks: Map<string, number>;
  reminderGroups: ReminderGroup[];
  groupLinks: Map<string, number>;
  sortMode: ReminderSortMode;
  habits: Habit[];
  habitCompletions: Map<number, Set<string>>;
  birthdays: Birthday[];
  navVisibility: NavVisibility;
  navOrder: string[];
}

function renderAddForm(classFolders: ClassFolder[], reminderGroups: ReminderGroup[]): string {
  return `
    <form method="POST" action="/donna/reminders" class="reminder-add-form" id="reminder-add-form" data-swap-target="reminders-main">
      <input type="hidden" name="action" value="add" />
      <input type="text" name="title" placeholder="Add a reminder…" required />
      <div class="reminder-add-row2">
        <label class="hint" style="margin:0;">Date</label>
        <input type="date" name="dueDate" id="reminder-due-date" />
        <label class="hint" style="margin:0;">Time</label>
        <input type="time" name="dueTime" id="reminder-due-time" />
        <button type="button" class="btn-secondary btn-small" onclick="setQuickDate(0)">Today</button>
        <button type="button" class="btn-secondary btn-small" onclick="setQuickDate(1)">Tomorrow</button>
      </div>
      <div class="reminder-add-row2">
        ${classFolders.length > 0 ? renderClassSelect(classFolders) : ""}
        ${renderGroupSelect(reminderGroups)}
      </div>
      <div class="hint">Set a time and Donna will text you a reminder then, not just show the due date.</div>
      ${renderEarlyLeadRow()}
      <textarea name="notes" placeholder="Notes (optional)"></textarea>
      <button class="btn" type="submit">Add</button>
    </form>`;
}

function renderEditForm(
  r: Reminder,
  timezone: string,
  notification: ReminderNotification | null | undefined,
  earlyNotification: ReminderNotification | null | undefined,
  classFolders: ClassFolder[],
  editingClassId: number | null | undefined,
  reminderGroups: ReminderGroup[],
  editingGroupId: number | null | undefined
): string {
  const due = effectiveDue(r, notification ?? undefined);
  const parts = due
    ? due.dateOnly
      ? { date: due.iso.slice(0, 10), time: "" }
      : toLocalDateTimeParts(due.iso, timezone)
    : { date: "", time: "" };
  const timeValue = due && hasTime(due) ? parts.time : "";
  const leadCurrent = due && earlyNotification ? leadTimeParts(due.iso, earlyNotification.notifyAt) : undefined;

  return `
    <form method="POST" action="/donna/reminders" class="reminder-edit-form" data-swap-target="reminders-main">
      <input type="hidden" name="action" value="update" />
      <input type="hidden" name="id" value="${escapeHtml(r.id)}" />

      <div class="field">
        <label for="edit-title">Title</label>
        <input type="text" id="edit-title" name="title" value="${escapeHtml(withTimeSuffix(r.title, null))}" required />
      </div>

      <div class="reminder-add-row2">
        <label class="hint" style="margin:0;">Date</label>
        <input type="date" name="dueDate" value="${escapeHtml(parts.date)}" />
        <label class="hint" style="margin:0;">Time</label>
        <input type="time" name="dueTime" value="${escapeHtml(timeValue)}" />
      </div>
      <div class="reminder-add-row2">
        ${classFolders.length > 0 ? renderClassSelect(classFolders, editingClassId ?? undefined) : ""}
        ${renderGroupSelect(reminderGroups, editingGroupId ?? undefined)}
      </div>
      <div class="hint">Set a time and Donna will text you a reminder then, not just show the due date.</div>
      ${renderEarlyLeadRow(leadCurrent)}

      <div class="field">
        <label for="edit-notes">Notes</label>
        <textarea id="edit-notes" name="notes">${escapeHtml(r.notes ?? "")}</textarea>
      </div>

      <div class="reminder-edit-actions">
        <button class="btn" type="submit">Save</button>
        <a class="btn btn-secondary" href="/donna/reminders">Cancel</a>
      </div>
    </form>
    <form method="POST" action="/donna/reminders" data-swap-target="reminders-main" style="margin-top: 8px;">
      <input type="hidden" name="action" value="delete" />
      <input type="hidden" name="id" value="${escapeHtml(r.id)}" />
      <button class="btn btn-danger" type="submit" onclick="return confirm('Delete this reminder?')">Delete reminder</button>
    </form>`;
}

function renderReminderList(
  reminders: Reminder[],
  timezone: string,
  notifications: Map<string, ReminderNotification>,
  earlyNotifications: Map<string, ReminderNotification>,
  reminderGroups: ReminderGroup[],
  groupLinks: Map<string, number>,
  sortMode: ReminderSortMode
): string {
  const groupById = new Map(reminderGroups.map((g) => [g.id, g]));

  if (sortMode === "due") {
    const sorted = sortRemindersByDue(reminders, notifications, timezone);
    return sorted
      .map((r) => renderReminderRow(r, timezone, notifications, earlyNotifications, groupById.get(groupLinks.get(r.id) ?? -1)))
      .join("\n");
  }

  // Group view: one section per reminder group (in creation order), each
  // internally sorted by due date, plus an "Ungrouped" section for
  // anything with no group.
  const sections = reminderGroups.map((g) => ({
    group: g,
    reminders: sortRemindersByDue(
      reminders.filter((r) => groupLinks.get(r.id) === g.id),
      notifications,
      timezone
    ),
  }));
  const ungrouped = sortRemindersByDue(
    reminders.filter((r) => !groupLinks.has(r.id)),
    notifications,
    timezone
  );
  if (ungrouped.length > 0 || sections.length === 0) {
    sections.push({ group: null as unknown as ReminderGroup, reminders: ungrouped });
  }

  return sections
    .map(({ group, reminders: groupReminders }) => {
      const borderStyle = group ? `border-left: 3px solid ${escapeHtml(group.color)}; padding-left: 10px;` : "";
      return `
    <div class="reminder-group" style="${borderStyle}">
      <div class="reminder-group-label">${group ? escapeHtml(group.name) : "Ungrouped"}</div>
      ${
        groupReminders.length === 0
          ? `<p class="empty">No reminders.</p>`
          : groupReminders
              .map((r) => renderReminderRow(r, timezone, notifications, earlyNotifications, group ?? undefined))
              .join("\n")
      }
    </div>`;
    })
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
    editingEarlyNotification,
    editingClassId,
    editingGroupId,
    notifications,
    earlyNotifications,
    classFolders,
    reminderGroups,
    groupLinks,
    sortMode,
    habits,
    habitCompletions,
    birthdays,
    navVisibility,
    navOrder,
  } = data;

  let body: string;

  if (editing) {
    body = `
      <div class="section">
        <h1 class="page-title">Edit reminder</h1>
      </div>
      <div class="card">
        ${renderEditForm(
          editing,
          timezone,
          editingNotification,
          editingEarlyNotification,
          classFolders,
          editingClassId,
          reminderGroups,
          editingGroupId
        )}
      </div>`;
  } else {
    const listHtml = !googleConfigured
      ? `<p class="empty">Not connected yet. Finish Google setup in Settings to use reminders.</p>`
      : reminders.length === 0
        ? `<p class="empty">No reminders. Nice.</p>`
        : renderReminderList(reminders, timezone, notifications, earlyNotifications, reminderGroups, groupLinks, sortMode);

    body = `
      <div class="section" style="display:flex; align-items:center; justify-content:space-between; gap: var(--sp-2);">
        <div>
          <h1 class="page-title">Reminders</h1>
          <p class="page-sub">${reminders.length} open</p>
          ${renderPageEditLink("settings-reminder-groups", "Groups")}
        </div>
        ${googleConfigured ? `<button type="button" class="btn-fab-inline" onclick="openAddReminderModal()" aria-label="Add reminder">+</button>` : ""}
      </div>
      ${error ? `<p class="hint" style="color:var(--danger);margin-bottom:16px;">${escapeHtml(error)}</p>` : ""}
      <div class="home-tabs">
        <a class="home-tab-btn ${sortMode === "due" ? "home-tab-btn-active" : ""}" href="/donna/reminders?sort=due">By due date</a>
        <a class="home-tab-btn ${sortMode === "group" ? "home-tab-btn-active" : ""}" href="/donna/reminders?sort=group">By group</a>
      </div>
      <div class="card" style="margin-top: var(--sp-3);">
        ${listHtml}
      </div>
      ${renderHabitsSection(habits, habitCompletions, localDateKey(new Date(), timezone))}
      ${renderBirthdaysSection(birthdays, timezone)}`;
  }

  const modalHtml = googleConfigured
    ? `
    <div class="modal-scrim" id="add-reminder-scrim">
      <div class="modal-panel" id="add-reminder-panel" onclick="event.stopPropagation()">
        <div class="modal-header">
          <span>Add reminder</span>
          <button class="modal-close" id="add-reminder-close" aria-label="Close">&#x2715;</button>
        </div>
        <div class="modal-body">
          ${renderAddForm(classFolders, reminderGroups)}
        </div>
      </div>
    </div>`
    : "";

  return renderLayout({
    title: "Donna Reminders",
    activeTab: "reminders",
    bodyHtml: `<div id="reminders-main">${body}</div>`,
    extraBodyHtml: modalHtml,
    pageScript: CLIENT_SCRIPT,
    showChatFab: true,
    navVisibility,
    navOrder,
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

  function openAddReminderModal() {
    const scrim = document.getElementById("add-reminder-scrim");
    if (scrim) scrim.classList.add("open");
  }

  function closeAddReminderModal() {
    const scrim = document.getElementById("add-reminder-scrim");
    if (scrim) scrim.classList.remove("open");
  }

  (function () {
    const scrim = document.getElementById("add-reminder-scrim");
    const closeBtn = document.getElementById("add-reminder-close");
    if (scrim) scrim.addEventListener("click", closeAddReminderModal);
    if (closeBtn) closeBtn.addEventListener("click", closeAddReminderModal);

    // Every reminders/habits action does a scoped swap of #reminders-main
    // now (see ROUTER_SCRIPT's data-swap-target support) rather than a
    // full page reload — closing the add modal here is what used to
    // happen for free via the old full-page navigation after a
    // successful add. Guarded on window since this script re-runs on
    // every client-routed visit to this page, but document itself (what
    // the listener is on) never gets recreated.
    if (!window.__remindersSwapListenerBound) {
      window.__remindersSwapListenerBound = true;
      document.addEventListener("donna:swapped", function (e) {
        if (!e.detail || e.detail.target !== "reminders-main") return;
        closeAddReminderModal();
        const addForm = document.getElementById("reminder-add-form");
        if (addForm) addForm.reset();
      });
    }
  })();
`;
