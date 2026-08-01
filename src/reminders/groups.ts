import { getSupabaseClient, withSupabaseRetry } from "../supabaseClient.js";

export interface ReminderGroup {
  id: number;
  name: string;
  color: string;
}

export async function getReminderGroups(): Promise<ReminderGroup[]> {
  const client = getSupabaseClient();
  const { data, error } = await withSupabaseRetry(() =>
    client.from("reminder_groups").select("id, name, color").order("created_at", { ascending: true })
  );

  if (error) {
    if (error.code === "PGRST205") return [];
    throw new Error(`Supabase read error: ${error.message}`);
  }
  return data ?? [];
}

export async function addReminderGroup(name: string, color: string): Promise<void> {
  const client = getSupabaseClient();
  const { error } = await withSupabaseRetry(() => client.from("reminder_groups").insert({ name, color }));

  if (error) {
    throw new Error(`Supabase insert error: ${error.message}`);
  }
}

export async function deleteReminderGroup(id: number): Promise<void> {
  const client = getSupabaseClient();
  const { error } = await withSupabaseRetry(() => client.from("reminder_groups").delete().eq("id", id));

  if (error) {
    throw new Error(`Supabase delete error: ${error.message}`);
  }
}

// Google Tasks has no custom-field support, so a reminder's optional group
// association lives here instead — same reasoning/shape as
// reminder_class_links, kept as an independent concept (a reminder can
// have a class link and a group at the same time, unrelated to each
// other).

// Both writes below tolerate a missing table (PGRST205) the same way the
// read functions above already do — clearGroupLink/linkReminderToGroup
// run unconditionally on every reminder add/update/delete (see
// api/donna-reminders.ts), so before the reminder_group_links migration
// is applied, a hard failure here would break ordinary reminder CRUD that
// has nothing to do with groups. A missing table is equivalent to "no
// group links exist yet" — safe to no-op rather than throw.

export async function linkReminderToGroup(googleTaskId: string, groupId: number): Promise<void> {
  const client = getSupabaseClient();
  const { error } = await withSupabaseRetry(() =>
    client
      .from("reminder_group_links")
      .upsert({ google_task_id: googleTaskId, group_id: groupId }, { onConflict: "google_task_id" })
  );

  if (error && error.code !== "PGRST205") {
    throw new Error(`Supabase upsert error: ${error.message}`);
  }
}

// Removes any group link for a task — used before setting a fresh one on
// edit, and when the group is cleared entirely.
export async function clearGroupLink(googleTaskId: string): Promise<void> {
  const client = getSupabaseClient();
  const { error } = await withSupabaseRetry(() =>
    client.from("reminder_group_links").delete().eq("google_task_id", googleTaskId)
  );

  if (error && error.code !== "PGRST205") {
    throw new Error(`Supabase delete error: ${error.message}`);
  }
}

export async function getGroupIdForTask(googleTaskId: string): Promise<number | null> {
  const client = getSupabaseClient();
  const { data, error } = await withSupabaseRetry(() =>
    client.from("reminder_group_links").select("group_id").eq("google_task_id", googleTaskId).maybeSingle()
  );

  if (error) {
    throw new Error(`Supabase read error: ${error.message}`);
  }
  return data?.group_id ?? null;
}

// Batched lookup for rendering a list of reminders/group sections without
// one query per row — mirrors getClassLinksForTasks's shape.
export async function getGroupLinksForTasks(taskIds: string[]): Promise<Map<string, number>> {
  if (taskIds.length === 0) return new Map();

  const client = getSupabaseClient();
  const { data, error } = await withSupabaseRetry(() =>
    client.from("reminder_group_links").select("google_task_id, group_id").in("google_task_id", taskIds)
  );

  if (error) {
    throw new Error(`Supabase read error: ${error.message}`);
  }

  const map = new Map<string, number>();
  for (const row of data ?? []) {
    map.set(row.google_task_id, row.group_id);
  }
  return map;
}
