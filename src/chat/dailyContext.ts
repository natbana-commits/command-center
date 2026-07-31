import { getSupabaseClient, withSupabaseRetry } from "../supabaseClient.js";
import type { NewsStory } from "../news/curate.js";
import type { CalendarEvent } from "../calendar.js";

const RETENTION_DAYS = 30;

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
}

export interface DailyContext {
  day: string;
  timezone: string;
  stories: NewsStory[];
  calendarEvents: StoredCalendarEvent[];
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
  const { error } = await withSupabaseRetry(() =>
    client.from("daily_context").upsert(
      {
        day: input.day,
        timezone: input.timezone,
        stories: input.stories,
        calendar_events: storedEvents,
      },
      { onConflict: "day" }
    )
  );

  if (error) {
    throw new Error(`Supabase upsert error: ${error.message}`);
  }
}

export async function getDailyContext(day: string): Promise<DailyContext | null> {
  const client = getSupabaseClient();
  const { data, error } = await withSupabaseRetry(() =>
    client
      .from("daily_context")
      .select("day, timezone, stories, calendar_events")
      .eq("day", day)
      .maybeSingle()
  );

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
  };
}

export async function pruneOldDailyContext(): Promise<void> {
  const client = getSupabaseClient();
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const { error } = await withSupabaseRetry(() =>
    client.from("daily_context").delete().lt("day", cutoff)
  );

  if (error) {
    throw new Error(`Supabase prune error: ${error.message}`);
  }
}
