import { getSupabaseClient, withSupabaseRetry } from "../supabaseClient.js";

const RETENTION_DAYS = 30;

export type NotificationKind = "main" | "early";

export interface ReminderNotification {
  id: number;
  googleTaskId: string;
  notifyAt: string;
  message: string;
  sent: boolean;
  kind: NotificationKind;
}

function rowToNotification(row: {
  id: number;
  google_task_id: string;
  notify_at: string;
  message: string;
  sent: boolean;
  kind: NotificationKind;
}): ReminderNotification {
  return {
    id: row.id,
    googleTaskId: row.google_task_id,
    notifyAt: row.notify_at,
    message: row.message,
    sent: row.sent,
    kind: row.kind,
  };
}

export async function scheduleNotification(
  googleTaskId: string,
  notifyAtIso: string,
  message: string,
  kind: NotificationKind = "main"
): Promise<void> {
  const client = getSupabaseClient();
  const { error } = await withSupabaseRetry(() =>
    client.from("reminder_notifications").insert({
      google_task_id: googleTaskId,
      notify_at: notifyAtIso,
      message,
      kind,
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
// Filtered to kind="main" so an early heads-up notification (which fires
// before the real due time, not at it) never gets picked up as "the" due
// time here. For callers that need both kinds at once, see
// getNotificationsForTasks below — one query instead of two.
export async function getPendingNotificationsForTasks(
  taskIds: string[]
): Promise<Map<string, ReminderNotification>> {
  if (taskIds.length === 0) return new Map();

  const client = getSupabaseClient();
  const { data, error } = await withSupabaseRetry(() =>
    client.from("reminder_notifications").select("*").in("google_task_id", taskIds).eq("sent", false).eq("kind", "main")
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

// Same shape as getPendingNotificationsForTasks, but returns both the
// "main" (real due-time) and "early" (optional heads-up) notification maps
// from a single query — for callers (the Reminders page) that need both at
// once instead of issuing two nearly-identical queries.
export async function getNotificationsForTasks(
  taskIds: string[]
): Promise<{ main: Map<string, ReminderNotification>; early: Map<string, ReminderNotification> }> {
  const main = new Map<string, ReminderNotification>();
  const early = new Map<string, ReminderNotification>();
  if (taskIds.length === 0) return { main, early };

  const client = getSupabaseClient();
  const { data, error } = await withSupabaseRetry(() =>
    client.from("reminder_notifications").select("*").in("google_task_id", taskIds).eq("sent", false)
  );

  if (error) {
    throw new Error(`Supabase read error: ${error.message}`);
  }

  for (const row of data ?? []) {
    const notification = rowToNotification(row);
    (notification.kind === "early" ? early : main).set(row.google_task_id, notification);
  }
  return { main, early };
}

// Removes any not-yet-sent notification for a task, of either kind — used
// before setting a fresh main/early pair on edit (so a stale time can't
// also fire) and when a due time is cleared entirely.
export async function clearPendingNotificationsForTask(googleTaskId: string): Promise<void> {
  const client = getSupabaseClient();
  const { error } = await withSupabaseRetry(() =>
    client.from("reminder_notifications").delete().eq("google_task_id", googleTaskId).eq("sent", false)
  );

  if (error) {
    throw new Error(`Supabase delete error: ${error.message}`);
  }
}

// Only ever deletes already-*sent* rows — a pending (unsent) notification
// should never be pruned, no matter how old, since it's still waiting to
// fire.
export async function pruneOldReminderNotifications(): Promise<void> {
  const client = getSupabaseClient();
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await withSupabaseRetry(() =>
    client.from("reminder_notifications").delete().eq("sent", true).lt("notify_at", cutoff)
  );

  if (error) {
    throw new Error(`Supabase prune error: ${error.message}`);
  }
}
