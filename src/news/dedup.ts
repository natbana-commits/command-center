import { getSupabaseClient, withSupabaseRetry } from "../supabaseClient.js";
import type { FeedItem } from "./feeds.js";

const DEDUP_WINDOW_DAYS = 7;

function cutoffISOString(): string {
  return new Date(Date.now() - DEDUP_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

export async function filterUnseen(items: FeedItem[]): Promise<FeedItem[]> {
  const client = getSupabaseClient();
  const { data, error } = await withSupabaseRetry(() =>
    client.from("seen_stories").select("url").gte("seen_at", cutoffISOString())
  );

  if (error) {
    throw new Error(`Supabase read error: ${error.message}`);
  }

  const seen = new Set((data ?? []).map((row) => row.url));
  return items.filter((item) => !seen.has(item.link));
}

export async function markSeen(urls: string[]): Promise<void> {
  if (urls.length === 0) return;

  // A single upsert can't affect the same conflict-key row twice in one
  // statement — Postgres errors on it outright — so duplicate URLs in the
  // input (the curation step has occasionally returned the same story
  // twice) need deduping here rather than trusting the caller.
  const uniqueUrls = [...new Set(urls)];
  const client = getSupabaseClient();
  const rows = uniqueUrls.map((url) => ({ url, seen_at: new Date().toISOString() }));
  const { error } = await withSupabaseRetry(() =>
    client.from("seen_stories").upsert(rows, { onConflict: "url" })
  );

  if (error) {
    throw new Error(`Supabase write error: ${error.message}`);
  }
}

export async function pruneOldSeen(): Promise<void> {
  const client = getSupabaseClient();
  const { error } = await withSupabaseRetry(() =>
    client.from("seen_stories").delete().lt("seen_at", cutoffISOString())
  );

  if (error) {
    throw new Error(`Supabase prune error: ${error.message}`);
  }
}
