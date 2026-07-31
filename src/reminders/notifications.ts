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
