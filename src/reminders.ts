import type { Reminder } from "./google/tasks.js";
import { escapeHtml } from "./util/html.js";

export function formatReminders(reminders: Reminder[], googleConfigured: boolean): string {
  if (!googleConfigured) {
    return "Not connected yet — finish Google setup to use reminders.";
  }
  if (reminders.length === 0) {
    return "No reminders.";
  }
  return reminders.map((r) => `• ${escapeHtml(r.title)}`).join("\n");
}
