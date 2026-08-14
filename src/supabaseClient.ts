import { createClient, type PostgrestError, type SupabaseClient } from "@supabase/supabase-js";

// Memoized at module scope (persists across calls within the same warm
// serverless container, same idiom as plaidClient.ts's cachedClient) —
// every store function in the app calls getSupabaseClient(), which used
// to construct a brand-new client (and its own internal auth sub-client)
// on every single call — 20+ times on a single Home render.
let cachedClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (cachedClient) return cachedClient;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment");
  }
  cachedClient = createClient(url, key);
  return cachedClient;
}

// Supabase's newer sb_secret_ key format intermittently fails validation
// with a transient "JWT issued at future" error (observed repeatedly in
// testing, not hypothetical) — retrying almost always succeeds immediately.
export async function withSupabaseRetry<T>(
  run: () => PromiseLike<{ data: T; error: PostgrestError | null }>,
  attempts = 3
): Promise<{ data: T; error: PostgrestError | null }> {
  let last: { data: T; error: PostgrestError | null } | undefined;
  for (let i = 0; i < attempts; i++) {
    last = await run();
    if (!last.error || !last.error.message.includes("JWT issued at future")) {
      return last;
    }
    await new Promise((resolve) => setTimeout(resolve, 250 * (i + 1)));
  }
  return last!;
}
