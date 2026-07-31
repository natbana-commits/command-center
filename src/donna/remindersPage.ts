import type { Reminder } from "../google/tasks.js";
import { escapeHtml } from "../util/html.js";
import { renderLayout } from "./layout.js";

function renderReminderRow(r: Reminder): string {
  return `
    <form method="POST" action="/donna/reminders" class="reminder-row">
      <input type="hidden" name="action" value="complete" />
      <input type="hidden" name="id" value="${escapeHtml(r.id)}" />
      <input type="checkbox" onchange="this.form.requestSubmit()" aria-label="Mark done" />
      <span class="reminder-title">${escapeHtml(r.title)}</span>
    </form>`;
}

export interface RemindersPageData {
  reminders: Reminder[];
  googleConfigured: boolean;
  error?: string;
}

export function buildRemindersHtml(data: RemindersPageData): string {
  const { reminders, googleConfigured, error } = data;

  const listHtml = !googleConfigured
    ? `<p class="empty">Not connected yet — finish Google setup in Settings to use reminders.</p>`
    : reminders.length === 0
      ? `<p class="empty">No reminders. Nice.</p>`
      : reminders.map(renderReminderRow).join("\n");

  const addForm = googleConfigured
    ? `
    <form method="POST" action="/donna/reminders" class="reminder-add-form">
      <input type="hidden" name="action" value="add" />
      <input type="text" name="title" placeholder="Add a reminder…" required />
      <button class="btn" type="submit">Add</button>
    </form>`
    : "";

  const body = `
    <div class="section">
      <h1 class="page-title">Reminders</h1>
      <p class="page-sub">${reminders.length} open</p>
    </div>
    ${error ? `<p class="hint" style="color:var(--danger);margin-bottom:16px;">${escapeHtml(error)}</p>` : ""}
    <div class="card">
      ${listHtml}
      ${addForm}
    </div>`;

  return renderLayout({
    title: "Donna Reminders",
    activeTab: "reminders",
    bodyHtml: body,
    showChatFab: true,
  });
}
