import { getSupabaseClient, withSupabaseRetry } from "../supabaseClient.js";
import { localDateKey } from "../util/time.js";

export interface Birthday {
  id: number;
  name: string;
  /** 1-12 */
  month: number;
  /** 1-31 */
  day: number;
  calendarEventId: string | null;
}

function rowToBirthday(row: { id: number; name: string; birth_month: number; birth_day: number; calendar_event_id: string | null }): Birthday {
  return { id: row.id, name: row.name, month: row.birth_month, day: row.birth_day, calendarEventId: row.calendar_event_id };
}

export async function getBirthdays(): Promise<Birthday[]> {
  const client = getSupabaseClient();
  const { data, error } = await withSupabaseRetry(() =>
    client.from("birthdays").select("id, name, birth_month, birth_day, calendar_event_id").order("created_at", { ascending: true })
  );

  if (error) {
    if (error.code === "PGRST205") return [];
    throw new Error(`Supabase read error: ${error.message}`);
  }
  return (data ?? []).map(rowToBirthday);
}

export async function addBirthday(name: string, month: number, day: number, calendarEventId: string | null): Promise<void> {
  const client = getSupabaseClient();
  const { error } = await withSupabaseRetry(() =>
    client.from("birthdays").insert({ name, birth_month: month, birth_day: day, calendar_event_id: calendarEventId })
  );

  if (error) {
    throw new Error(`Supabase insert error: ${error.message}`);
  }
}

export async function deleteBirthday(id: number): Promise<void> {
  const client = getSupabaseClient();
  const { error } = await withSupabaseRetry(() => client.from("birthdays").delete().eq("id", id));

  if (error) {
    throw new Error(`Supabase delete error: ${error.message}`);
  }
}

// Checked by the morning brief — today's date in the configured timezone,
// matched against month/day only (year is never stored).
export async function getTodaysBirthdays(timezone: string): Promise<Birthday[]> {
  const todayKey = localDateKey(new Date(), timezone);
  const [, month, day] = todayKey.split("-").map(Number);
  const birthdays = await getBirthdays();
  return birthdays.filter((b) => b.month === month && b.day === day);
}
