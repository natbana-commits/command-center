import { getSupabaseClient } from "../supabaseClient.js";
import type { NewsStory } from "../news/curate.js";
import type { CalendarEvent } from "../calendar.js";

export interface StoredCalendarEvent {
  summary: string;
  start: string;
  end?: string;
  location?: string;
  description?: string;
}

export interface DailyContextInput {
  day: string;
  timezone: string;
  stories: NewsStory[];
  events: CalendarEvent[];
  reminders: string[];
}

export interface DailyContext {
  day: string;
  timezone: string;
  stories: NewsStory[];
  calendarEvents: StoredCalendarEvent[];
  reminders: string[];
}

export async function storeDailyContext(input: DailyContextInput): Promise<void> {
  const storedEvents: StoredCalendarEvent[] = input.events.map((e) => ({
    summary: e.summary,
    start: e.start.toISOString(),
    end: e.end?.toISOString(),
    location: e.location,
    description: e.description,
  }));

  const client = getSupabaseClient();
  const { error } = await client.from("daily_context").upsert(
    {
      day: input.day,
      timezone: input.timezone,
      stories: input.stories,
      calendar_events: storedEvents,
      reminders: input.reminders,
    },
    { onConflict: "day" }
  );

  if (error) {
    throw new Error(`Supabase upsert error: ${error.message}`);
  }
}

export async function getDailyContext(day: string): Promise<DailyContext | null> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from("daily_context")
    .select("day, timezone, stories, calendar_events, reminders")
    .eq("day", day)
    .maybeSingle();

  if (error) {
    throw new Error(`Supabase read error: ${error.message}`);
  }
  if (!data) {
    return null;
  }

  return {
    day: data.day,
    timezone: data.timezone,
    stories: data.stories,
    calendarEvents: data.calendar_events,
    reminders: data.reminders,
  };
}
