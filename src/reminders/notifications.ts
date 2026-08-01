import { getSupabaseClient, withSupabaseRetry } from "../supabaseClient.js";

export interface ReminderNotification {
  id: number;
  googleTaskId: string;
  notifyAt: string;
  message: string;
  sent: boolean;
}

function rowToNotification(row: {
  id: number;
  google_task_id: string;
  notify_at: string;
  message: string;
  sent: boolean;
}): ReminderNotification {
  return {
    id: row.id,
    googleTaskId: row.google_task_id,
    notifyAt: row.notify_at,
    message: row.message,
    sent: row.sent,
  };
}

export async function scheduleNotification(
  googleTaskId: string,
  notifyAtIso: string,
  message: string
): Promise<void> {
  const client = getSupabaseClient();
  const { error } = await withSupabaseRetry(() =>
    client.from("reminder_notifications").insert({
      google_task_id: googleTaskId,
      notify_at: notifyAtIso,
      message,
    })
  );

  if (error) {
    throw new Error(`Supabase insert error: ${error.message}`);
  }
}

export async function getDueNotifications(): Promise<ReminderNotification[]> {
  const client = getSupabaseClient();
  const { data, error } = await withSupabaseRetry(() =>
    client
      .from("reminder_notifications")
      .select("*")
      .eq("sent", false)
      .lte("notify_at", new Date().toISOString())
      .order("notify_at", { ascending: true })
  );

  if (error) {
    throw new Error(`Supabase read error: ${error.message}`);
  }
  return (data ?? []).map(rowToNotification);
}

export async function markNotificationSent(id: number): Promise<void> {
  const client = getSupabaseClient();
  const { error } = await withSupabaseRetry(() =>
    client.from("reminder_notifications").update({ sent: true }).eq("id", id)
  );

  if (error) {
    throw new Error(`Supabase update error: ${error.message}`);
  }
}

// Google Tasks' `due` field silently discards whatever time-of-day is sent
// and always stores midnight UTC (confirmed directly against the live API,
// not just a client-display quirk) — so this table is the only place a
// reminder's actual due *time* exists. Building a map keyed by task id lets
// the Reminders page show/edit the real time instead of Google's zeroed one.
export async function getPendingNotificationsForTasks(
  taskIds: string[]
): Promise<Map<string, ReminderNotification>> {
  if (taskIds.length === 0) return new Map();

  const client = getSupabaseClient();
  const { data, error } = await withSupabaseRetry(() =>
    client
      .from("reminder_notifications")
      .select("*")
      .in("google_task_id", taskIds)
      .eq("sent", false)
  );

  if (error) {
    throw new Error(`Supabase read error: ${error.message}`);
  }

  const map = new Map<string, ReminderNotification>();
  for (const row of data ?? []) {
    map.set(row.google_task_id, rowToNotification(row));
  }
  return map;
}

// Removes any not-yet-sent notification for a task — used before setting a
// new one on edit (so the old time doesn't also fire) and when a due time
// is cleared entirely.
export async function clearPendingNotificationsForTask(googleTaskId: string): Promise<void> {
  const client = getSupabaseClient();
  const { error } = await withSupabaseRetry(() =>
    client.from("reminder_notifications").delete().eq("google_task_id", googleTaskId).eq("sent", false)
  );

  if (error) {
    throw new Error(`Supabase delete error: ${error.message}`);
  }
}
