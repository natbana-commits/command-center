import { getSupabaseClient } from "../supabaseClient.js";
import type { FeedItem } from "./feeds.js";

const DEDUP_WINDOW_DAYS = 7;

function cutoffISOString(): string {
  return new Date(Date.now() - DEDUP_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

export async function filterUnseen(items: FeedItem[]): Promise<FeedItem[]> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from("seen_stories")
    .select("url")
    .gte("seen_at", cutoffISOString());

  if (error) {
    throw new Error(`Supabase read error: ${error.message}`);
  }

  const seen = new Set((data ?? []).map((row) => row.url));
  return items.filter((item) => !seen.has(item.link));
}

export async function markSeen(urls: string[]): Promise<void> {
  if (urls.length === 0) return;

  const client = getSupabaseClient();
  const rows = urls.map((url) => ({ url, seen_at: new Date().toISOString() }));
  const { error } = await client.from("seen_stories").upsert(rows, { onConflict: "url" });

  if (error) {
    throw new Error(`Supabase write error: ${error.message}`);
  }
}

export async function pruneOldSeen(): Promise<void> {
  const client = getSupabaseClient();
  const { error } = await client.from("seen_stories").delete().lt("seen_at", cutoffISOString());

  if (error) {
    throw new Error(`Supabase prune error: ${error.message}`);
  }
}
