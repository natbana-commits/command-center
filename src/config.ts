import settingsData from "../config/settings.json" with { type: "json" };

export interface Settings {
  reminders: string[];
}

export function loadSettings(): Settings {
  return settingsData as Settings;
}
