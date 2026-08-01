import type { VercelRequest } from "@vercel/node";
import { getSupabaseClient, withSupabaseRetry } from "../supabaseClient.js";

// Simple rolling-window lockout: MAX_ATTEMPTS failed logins from the same
// IP within WINDOW_MINUTES blocks further attempts (without even checking
// the password) until enough of them age out of the window. A determined
// attacker who keeps retrying just keeps the window rolling forward and
// stays locked out — that's the intended behavior, not a bug.
const MAX_ATTEMPTS = 5;
const WINDOW_MINUTES = 15;
const PRUNE_AFTER_DAYS = 1;

// Vercel's proxy sets x-forwarded-for on every request (the same trust
// model already used for secureCookieFlag's x-forwarded-proto check in
// session.ts) — a client can't spoof this past Vercel's own edge.
function getClientIp(req: VercelRequest): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim();
  }
  return req.socket?.remoteAddress ?? "unknown";
}

// This is a rate-limit bookkeeping check, not the actual auth check —
// failing open (allowing the login attempt through) on a Supabase error
// is the deliberate choice here, so a database hiccup can never lock
// Nathan out of his own app. Every caller already wraps these in .catch().

export async function isLoginLocked(req: VercelRequest): Promise<boolean> {
  const ip = getClientIp(req);
  const client = getSupabaseClient();
  const since = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString();

  // A plain row fetch (rather than a `count`-only query) so the response
  // shape matches withSupabaseRetry's plain {data, error} signature — the
  // row count itself is all that's needed here, capped well below any
  // real performance concern by MAX_ATTEMPTS's own small size.
  const { data, error } = await withSupabaseRetry(() =>
    client.from("login_attempts").select("id").eq("ip_address", ip).gte("attempted_at", since)
  );

  if (error) {
    if (error.code === "PGRST205") return false;
    throw new Error(`Supabase read error: ${error.message}`);
  }
  return (data ?? []).length >= MAX_ATTEMPTS;
}

export async function recordFailedLogin(req: VercelRequest): Promise<void> {
  const ip = getClientIp(req);
  const client = getSupabaseClient();
  const { error } = await withSupabaseRetry(() => client.from("login_attempts").insert({ ip_address: ip }));

  if (error && error.code !== "PGRST205") {
    throw new Error(`Supabase insert error: ${error.message}`);
  }
}

export async function clearFailedLogins(req: VercelRequest): Promise<void> {
  const ip = getClientIp(req);
  const client = getSupabaseClient();
  const { error } = await withSupabaseRetry(() => client.from("login_attempts").delete().eq("ip_address", ip));

  if (error && error.code !== "PGRST205") {
    throw new Error(`Supabase delete error: ${error.message}`);
  }
}

// Called once daily from formatBrief.ts alongside every other prune —
// keeps this table from growing unbounded under a sustained attack.
export async function pruneOldLoginAttempts(): Promise<void> {
  const client = getSupabaseClient();
  const cutoff = new Date(Date.now() - PRUNE_AFTER_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await withSupabaseRetry(() => client.from("login_attempts").delete().lt("attempted_at", cutoff));

  if (error && error.code !== "PGRST205") {
    throw new Error(`Supabase prune error: ${error.message}`);
  }
}
