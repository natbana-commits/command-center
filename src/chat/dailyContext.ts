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

  // brief_sent_at marks this as the "fast pass" (see formatBrief.ts's
  // buildFastBriefMessages) having run for the day — the dynamic
  // scheduler (checkAndSendScheduledBrief, called from every 5-minute
  // reminder-check poll) uses it to guarantee the fast pass fires at
  // most once per day, same idea as news_attempted_at below for the
  // separate, later news-curation pass.
  const client = getSupabaseClient();
  const { error } = await withSupabaseRetry(() =>
    client.from("daily_context").upsert(
      {
        day: input.day,
        timezone: input.timezone,
        stories: input.stories,
        calendar_events: storedEvents,
        brief_sent_at: new Date().toISOString(),
      },
      { onConflict: "day" }
    )
  );

  if (error) {
    throw new Error(`Supabase upsert error: ${error.message}`);
  }
}

export interface BriefScheduleState {
  briefSentAt: string | null;
  newsAttemptedAt: string | null;
}

export async function getTodaysBriefState(day: string): Promise<BriefScheduleState | null> {
  const client = getSupabaseClient();
  const { data, error } = await withSupabaseRetry(() =>
    client.from("daily_context").select("brief_sent_at, news_attempted_at").eq("day", day).maybeSingle()
  );
  if (error) {
    throw new Error(`Supabase read error: ${error.message}`);
  }
  if (!data) return null;
  return { briefSentAt: data.brief_sent_at, newsAttemptedAt: data.news_attempted_at };
}

// Phase-B-only write (see formatBrief.ts's buildNewsFollowupMessages) —
// a plain update rather than a full upsert, so it only ever touches the
// `stories` and `news_attempted_at` columns, leaving the day/timezone/
// calendar_events the fast pass already wrote untouched. Marks the
// attempt regardless of whether any stories were actually found/sent
// (a quiet news day or a curation failure both count as "handled" for
// today — see CURATION_TIMEOUT_MS's "delayed, not lost" reasoning),
// which is what stops the scheduler from retrying every 5 minutes.
// Returns false if no row existed yet to update (the fast pass hasn't
// run today) so the caller can fall back to a full write instead of
// silently losing the news.
export async function updateDailyContextStories(day: string, stories: NewsStory[]): Promise<boolean> {
  const client = getSupabaseClient();
  const { data, error } = await withSupabaseRetry(() =>
    client
      .from("daily_context")
      .update({ stories, news_attempted_at: new Date().toISOString() })
      .eq("day", day)
      .select("day")
  );
  if (error) {
    throw new Error(`Supabase update error: ${error.message}`);
  }
  return (data ?? []).length > 0;
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
