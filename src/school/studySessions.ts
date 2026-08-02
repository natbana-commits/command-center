import { getSupabaseClient, withSupabaseRetry } from "../supabaseClient.js";
import { localDateKey, consecutiveDayStreak } from "../util/time.js";

export async function logStudySession(classId: number, durationMinutes: number): Promise<void> {
  const client = getSupabaseClient();
  const { error } = await withSupabaseRetry(() =>
    client.from("study_sessions").insert({ class_id: classId, duration_minutes: durationMinutes })
  );
  if (error) {
    throw new Error(`Supabase insert error: ${error.message}`);
  }
}

export interface StudyStats {
  streakDays: number;
  weeklyMinutes: number;
}

// A year of history is plenty for any realistic streak, and cheap at
// personal scale — simpler than a second query just to bound the range
// tighter for the weekly-minutes half of this.
const HISTORY_DAYS = 365;

export async function getStudyStats(classId: number, timezone: string): Promise<StudyStats> {
  const client = getSupabaseClient();
  const cutoff = new Date(Date.now() - HISTORY_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await withSupabaseRetry(() =>
    client
      .from("study_sessions")
      .select("duration_minutes, completed_at")
      .eq("class_id", classId)
      .gte("completed_at", cutoff)
  );

  if (error) {
    if (error.code === "PGRST205") return { streakDays: 0, weeklyMinutes: 0 };
    throw new Error(`Supabase read error: ${error.message}`);
  }

  const sessions = data ?? [];
  const dateKeys = new Set(sessions.map((s) => localDateKey(new Date(s.completed_at), timezone)));
  const todayKey = localDateKey(new Date(), timezone);
  const streakDays = consecutiveDayStreak(dateKeys, todayKey);

  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const weeklyMinutes = sessions
    .filter((s) => new Date(s.completed_at).getTime() >= weekAgo)
    .reduce((sum, s) => sum + s.duration_minutes, 0);

  return { streakDays, weeklyMinutes };
}
