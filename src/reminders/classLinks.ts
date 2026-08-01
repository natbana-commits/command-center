import { getSupabaseClient, withSupabaseRetry } from "../supabaseClient.js";

// Google Tasks has no custom-field support, so a reminder's optional
// class association lives here instead — same reasoning as
// reminder_notifications tracking the real due time Tasks can't carry.

export async function linkReminderToClass(googleTaskId: string, classId: number): Promise<void> {
  const client = getSupabaseClient();
  const { error } = await withSupabaseRetry(() =>
    client
      .from("reminder_class_links")
      .upsert({ google_task_id: googleTaskId, class_id: classId }, { onConflict: "google_task_id" })
  );

  if (error) {
    throw new Error(`Supabase upsert error: ${error.message}`);
  }
}

// Removes any class link for a task — used before setting a fresh one on
// edit, and when the class is cleared entirely.
export async function clearClassLink(googleTaskId: string): Promise<void> {
  const client = getSupabaseClient();
  const { error } = await withSupabaseRetry(() =>
    client.from("reminder_class_links").delete().eq("google_task_id", googleTaskId)
  );

  if (error) {
    throw new Error(`Supabase delete error: ${error.message}`);
  }
}

export async function getClassIdForTask(googleTaskId: string): Promise<number | null> {
  const client = getSupabaseClient();
  const { data, error } = await withSupabaseRetry(() =>
    client
      .from("reminder_class_links")
      .select("class_id")
      .eq("google_task_id", googleTaskId)
      .maybeSingle()
  );

  if (error) {
    throw new Error(`Supabase read error: ${error.message}`);
  }
  return data?.class_id ?? null;
}

// Batched lookup for rendering a list of reminders/class sections without
// one query per row — mirrors getPendingNotificationsForTasks's shape.
export async function getClassLinksForTasks(taskIds: string[]): Promise<Map<string, number>> {
  if (taskIds.length === 0) return new Map();

  const client = getSupabaseClient();
  const { data, error } = await withSupabaseRetry(() =>
    client.from("reminder_class_links").select("google_task_id, class_id").in("google_task_id", taskIds)
  );

  if (error) {
    throw new Error(`Supabase read error: ${error.message}`);
  }

  const map = new Map<string, number>();
  for (const row of data ?? []) {
    map.set(row.google_task_id, row.class_id);
  }
  return map;
}
