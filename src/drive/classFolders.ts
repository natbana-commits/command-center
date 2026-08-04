import { getSupabaseClient, withSupabaseRetry } from "../supabaseClient.js";

export interface ClassFolder {
  id: number;
  className: string;
  driveFolderId: string;
}

export async function getClassFolders(): Promise<ClassFolder[]> {
  const client = getSupabaseClient();
  const { data, error } = await withSupabaseRetry(() =>
    client
      .from("class_folders")
      .select("id, class_name, drive_folder_id")
      .order("created_at", { ascending: true })
  );

  if (error) {
    // The class_folders table is optional infrastructure — until it's
    // created, the page should just show no classes rather than fail
    // entirely (same pattern as getNewslettersForDay).
    if (error.code === "PGRST205") {
      return [];
    }
    throw new Error(`Supabase read error: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    className: row.class_name,
    driveFolderId: row.drive_folder_id,
  }));
}

export async function addClassFolder(className: string, driveFolderId: string): Promise<void> {
  const client = getSupabaseClient();
  const { error } = await withSupabaseRetry(() =>
    client.from("class_folders").insert({ class_name: className, drive_folder_id: driveFolderId })
  );

  if (error) {
    throw new Error(`Supabase insert error: ${error.message}`);
  }
}

export async function renameClassFolder(id: number, className: string): Promise<void> {
  const client = getSupabaseClient();
  const { error } = await withSupabaseRetry(() =>
    client.from("class_folders").update({ class_name: className }).eq("id", id)
  );

  if (error) {
    throw new Error(`Supabase update error: ${error.message}`);
  }
}

export async function deleteClassFolder(id: number): Promise<void> {
  const client = getSupabaseClient();
  const { error } = await withSupabaseRetry(() => client.from("class_folders").delete().eq("id", id));

  if (error) {
    throw new Error(`Supabase delete error: ${error.message}`);
  }
}
