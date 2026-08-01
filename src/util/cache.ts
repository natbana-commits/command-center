import { getSupabaseClient, withSupabaseRetry } from "../supabaseClient.js";

// Short-TTL cache for slow live external-API reads (Google Calendar/
// Tasks/Drive) that would otherwise be re-fetched on every page load.
// Backed by Supabase like everything else here rather than adding new
// infra. Never throws on a cache-layer failure — a cache miss just means
// falling through to the real fetch, same as if nothing were cached.
export async function getOrFetch<T>(key: string, ttlSeconds: number, fetcher: () => Promise<T>): Promise<T> {
  const client = getSupabaseClient();

  const { data } = await withSupabaseRetry(() =>
    client.from("api_cache").select("payload, expires_at").eq("cache_key", key).maybeSingle()
  ).catch(() => ({ data: null }) as { data: null });

  if (data && new Date(data.expires_at).getTime() > Date.now()) {
    return data.payload as T;
  }

  const fresh = await fetcher();

  await withSupabaseRetry(() =>
    client
      .from("api_cache")
      .upsert(
        { cache_key: key, payload: fresh, expires_at: new Date(Date.now() + ttlSeconds * 1000).toISOString() },
        { onConflict: "cache_key" }
      )
  ).catch(() => undefined);

  return fresh;
}

export async function invalidateCache(key: string): Promise<void> {
  const client = getSupabaseClient();
  await withSupabaseRetry(() => client.from("api_cache").delete().eq("cache_key", key)).catch(() => undefined);
}
