import type { Settings } from "./config.js";

export function formatReminders(settings: Settings): string {
  if (settings.reminders.length === 0) {
    return "No reminders.";
  }
  return settings.reminders.map((r) => `- ${r}`).join("\n");
}
