import type { VercelRequest } from "@vercel/node";
import { getSupabaseClient, withSupabaseRetry } from "../supabaseClient.js";

const PRUNE_AFTER_DAYS = 1;

// Same trust model as loginAttempts.ts's getClientIp — Vercel's proxy sets
// x-forwarded-for on every request, so a client can't spoof this past
// Vercel's own edge.
function getClientIp(req: VercelRequest): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim();
  }
  return req.socket?.remoteAddress ?? "unknown";
}

// Generic per-IP, per-bucket sliding-window limiter for authenticated
// endpoints that front a paid/expensive backend (LLM, transcription, OCR).
// This is a secondary layer behind requireAuth — the scenario it defends
// against is a compromised session cookie being used to hammer those APIs,
// not unauthenticated abuse (requireAuth already blocks that). Like
// loginAttempts.ts, this fails open on a Supabase error: a DB hiccup
// throttling Nathan's own use of his own app would be worse than the rare
// window where a rate-limit check silently doesn't apply.
export async function isRateLimited(
  req: VercelRequest,
  bucket: string,
  maxHits: number,
  windowMinutes: number
): Promise<boolean> {
  const ip = getClientIp(req);
  const client = getSupabaseClient();
  const since = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();

  const { data, error } = await withSupabaseRetry(() =>
    client.from("rate_limit_hits").select("id").eq("bucket", bucket).eq("ip_address", ip).gte("occurred_at", since)
  );
  if (error) {
    if (error.code === "PGRST205") return false;
    throw new Error(`Supabase read error: ${error.message}`);
  }

  const limited = (data ?? []).length >= maxHits;
  if (limited) return true;

  // Only record on requests that are actually let through, so the count
  // reflects "N allowed requests per window" rather than growing forever
  // once a client is already over the limit.
  const { error: insertError } = await withSupabaseRetry(() =>
    client.from("rate_limit_hits").insert({ bucket, ip_address: ip })
  );
  if (insertError && insertError.code !== "PGRST205") {
    throw new Error(`Supabase insert error: ${insertError.message}`);
  }
  return false;
}

// Called daily from formatBrief.ts alongside every other prune.
export async function pruneOldRateLimitHits(): Promise<void> {
  const client = getSupabaseClient();
  const cutoff = new Date(Date.now() - PRUNE_AFTER_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await withSupabaseRetry(() => client.from("rate_limit_hits").delete().lt("occurred_at", cutoff));

  if (error && error.code !== "PGRST205") {
    throw new Error(`Supabase prune error: ${error.message}`);
  }
}
