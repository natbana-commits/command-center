import { getSupabaseClient, withSupabaseRetry } from "../supabaseClient.js";
import { localDateKey, consecutiveDayStreak } from "../util/time.js";

export interface Habit {
  id: number;
  title: string;
  /** "HH:MM", 24-hour, local to the configured timezone. */
  notifyTime: string;
  active: boolean;
  lastNotifiedDate: string | null;
}

function rowToHabit(row: {
  id: number;
  title: string;
  notify_time: string;
  active: boolean;
  last_notified_date: string | null;
}): Habit {
  return {
    id: row.id,
    title: row.title,
    notifyTime: row.notify_time,
    active: row.active,
    lastNotifiedDate: row.last_notified_date,
  };
}

export async function getHabits(): Promise<Habit[]> {
  const client = getSupabaseClient();
  const { data, error } = await withSupabaseRetry(() =>
    client
      .from("habits")
      .select("id, title, notify_time, active, last_notified_date")
      .order("created_at", { ascending: true })
  );

  if (error) {
    if (error.code === "PGRST205") return [];
    throw new Error(`Supabase read error: ${error.message}`);
  }
  return (data ?? []).map(rowToHabit);
}

export async function addHabit(title: string, notifyTime: string): Promise<void> {
  const client = getSupabaseClient();
  const { error } = await withSupabaseRetry(() =>
    client.from("habits").insert({ title, notify_time: notifyTime })
  );

  if (error) {
    throw new Error(`Supabase insert error: ${error.message}`);
  }
}

// habit_completions rows cascade-delete with the habit (FK ON DELETE CASCADE).
export async function deleteHabit(id: number): Promise<void> {
  const client = getSupabaseClient();
  const { error } = await withSupabaseRetry(() => client.from("habits").delete().eq("id", id));

  if (error) {
    throw new Error(`Supabase delete error: ${error.message}`);
  }
}

// Batched lookup for rendering the habit list without one query per habit —
// mirrors getGroupLinksForTasks's shape. Keyed by habit id, valued by the
// full set of completed-date keys (not just today's), since streak
// calculation needs the whole history.
export async function getCompletedDatesForHabits(habitIds: number[]): Promise<Map<number, Set<string>>> {
  const map = new Map<number, Set<string>>();
  if (habitIds.length === 0) return map;

  const client = getSupabaseClient();
  const { data, error } = await withSupabaseRetry(() =>
    client.from("habit_completions").select("habit_id, completed_date").in("habit_id", habitIds)
  );

  if (error) {
    if (error.code === "PGRST205") return map;
    throw new Error(`Supabase read error: ${error.message}`);
  }

  for (const row of data ?? []) {
    const set = map.get(row.habit_id);
    if (set) {
      set.add(row.completed_date);
    } else {
      map.set(row.habit_id, new Set([row.completed_date]));
    }
  }
  return map;
}

// Idempotent toggle for a single day — checking an already-checked day
// unchecks it, matching the reminder "complete" checkbox's own click-to-
// toggle feel on the Reminders page.
export async function toggleHabitCompletion(habitId: number, dateKey: string): Promise<void> {
  const client = getSupabaseClient();
  const { data, error: selectError } = await withSupabaseRetry(() =>
    client
      .from("habit_completions")
      .select("id")
      .eq("habit_id", habitId)
      .eq("completed_date", dateKey)
      .maybeSingle()
  );

  if (selectError) {
    throw new Error(`Supabase read error: ${selectError.message}`);
  }

  if (data) {
    const { error } = await withSupabaseRetry(() => client.from("habit_completions").delete().eq("id", data.id));
    if (error) throw new Error(`Supabase delete error: ${error.message}`);
  } else {
    const { error } = await withSupabaseRetry(() =>
      client.from("habit_completions").insert({ habit_id: habitId, completed_date: dateKey })
    );
    if (error) throw new Error(`Supabase insert error: ${error.message}`);
  }
}

export const computeStreak = consecutiveDayStreak;

// Habits whose notify_time has just passed today and haven't been nudged
// yet today — checked from the same GitHub-Actions-driven poll that already
// fires reminder texts (handleReminderCheck in api/morning-brief.ts).
// Plain "HH:MM" string comparison works because both sides are zero-padded
// 24-hour strings for the same timezone.
export async function getDueHabitNudges(timezone: string): Promise<Habit[]> {
  const habits = await getHabits();
  const now = new Date();
  const todayKey = localDateKey(now, timezone);
  const nowHHMM = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);

  return habits.filter((h) => h.active && h.notifyTime <= nowHHMM && h.lastNotifiedDate !== todayKey);
}

export async function markHabitNotified(habitId: number, dateKey: string): Promise<void> {
  const client = getSupabaseClient();
  const { error } = await withSupabaseRetry(() =>
    client.from("habits").update({ last_notified_date: dateKey }).eq("id", habitId)
  );

  if (error) {
    throw new Error(`Supabase update error: ${error.message}`);
  }
}
