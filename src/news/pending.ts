import { getSupabaseClient } from "../supabaseClient.js";
import type { NewsStory } from "./curate.js";

export interface PendingStories {
  id: number;
  urls: string[];
}

export async function storePendingStories(stories: NewsStory[]): Promise<void> {
  if (stories.length === 0) return;

  const client = getSupabaseClient();
  const { error } = await client
    .from("pending_stories")
    .insert({ urls: stories.map((s) => s.url) });

  if (error) {
    throw new Error(`Supabase insert error: ${error.message}`);
  }
}

export async function getLatestPendingStories(): Promise<PendingStories | null> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from("pending_stories")
    .select("id, urls")
    .eq("resolved", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Supabase read error: ${error.message}`);
  }

  return data as PendingStories | null;
}

export async function resolvePendingStories(id: number): Promise<void> {
  const client = getSupabaseClient();
  const { error } = await client.from("pending_stories").update({ resolved: true }).eq("id", id);

  if (error) {
    throw new Error(`Supabase update error: ${error.message}`);
  }
}
