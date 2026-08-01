import { getSupabaseClient, withSupabaseRetry } from "../supabaseClient.js";

export interface WatchlistEntry {
  id: number;
  label: string;
}

export async function getWatchlistEntries(): Promise<WatchlistEntry[]> {
  const client = getSupabaseClient();
  const { data, error } = await withSupabaseRetry(() =>
    client.from("watchlist_entries").select("id, label").order("created_at", { ascending: true })
  );

  if (error) {
    // Optional infrastructure — until the table exists, curation should
    // just run with no watchlist rather than fail entirely (same pattern
    // as getClassFolders/getNewslettersForDay).
    if (error.code === "PGRST205") {
      return [];
    }
    throw new Error(`Supabase read error: ${error.message}`);
  }

  return (data ?? []).map((row) => ({ id: row.id, label: row.label }));
}

export async function addWatchlistEntry(label: string): Promise<void> {
  const client = getSupabaseClient();
  const { error } = await withSupabaseRetry(() => client.from("watchlist_entries").insert({ label }));

  if (error) {
    throw new Error(`Supabase insert error: ${error.message}`);
  }
}

export async function deleteWatchlistEntry(id: number): Promise<void> {
  const client = getSupabaseClient();
  const { error } = await withSupabaseRetry(() => client.from("watchlist_entries").delete().eq("id", id));

  if (error) {
    throw new Error(`Supabase delete error: ${error.message}`);
  }
}
