import type { Settings } from "./config.js";
import { escapeHtml } from "./util/html.js";

export function formatReminders(settings: Settings): string {
  if (settings.reminders.length === 0) {
    return "No reminders.";
  }
  return settings.reminders.map((r) => `• ${escapeHtml(r)}`).join("\n");
}
