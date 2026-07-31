import { loadSettings } from "./config.js";
import { formatReminders } from "./reminders.js";
import { getTodaysEvents, formatEvents } from "./calendar.js";

export async function formatBrief(): Promise<string> {
  const settings = loadSettings();
  const events = await getTodaysEvents();

  return [
    "Good morning — here's your Command Center brief:",
    "",
    "Today's Calendar:",
    formatEvents(events),
    "",
    "Reminders:",
    formatReminders(settings),
  ].join("\n");
}
