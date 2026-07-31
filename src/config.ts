import { getSupabaseClient, withSupabaseRetry } from "./supabaseClient.js";

export interface Settings {
  timezone: string;
  newsletterQuery: string;
}

const DEFAULT_SETTINGS: Settings = {
  timezone: "America/New_York",
  newsletterQuery: "newer_than:2d label:newsletters",
};

export async function loadSettings(): Promise<Settings> {
  const client = getSupabaseClient();
  const { data, error } = await withSupabaseRetry(() =>
    client.from("app_settings").select("timezone, newsletter_query").eq("id", 1).maybeSingle()
  );

  if (error || !data) {
    return DEFAULT_SETTINGS;
  }

  return {
    timezone: data.timezone,
    newsletterQuery: data.newsletter_query,
  };
}

export async function saveSettings(settings: Partial<Settings>): Promise<void> {
  const update: Record<string, unknown> = { id: 1, updated_at: new Date().toISOString() };
  if (settings.timezone !== undefined) update.timezone = settings.timezone;
  if (settings.newsletterQuery !== undefined) update.newsletter_query = settings.newsletterQuery;

  const client = getSupabaseClient();
  const { error } = await withSupabaseRetry(() =>
    client.from("app_settings").upsert(update, { onConflict: "id" })
  );

  if (error) {
    throw new Error(`Supabase settings save error: ${error.message}`);
  }
}
