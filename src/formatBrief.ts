import { loadSettings } from "./config.js";
import { formatReminders } from "./reminders.js";

export function formatBrief(): string {
  const settings = loadSettings();
  return [
    "Good morning — here's your Command Center brief:",
    "",
    "Reminders:",
    formatReminders(settings),
  ].join("\n");
}
