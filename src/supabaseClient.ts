import { createClient, type PostgrestError } from "@supabase/supabase-js";

export function getSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment");
  }
  return createClient(url, key);
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
