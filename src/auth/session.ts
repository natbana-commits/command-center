import crypto from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseClient, withSupabaseRetry } from "../supabaseClient.js";

// App-wide login gate: a single shared password (DASHBOARD_PASSWORD) and an
// HMAC-signed, HttpOnly session cookie (SESSION_SECRET) — replacing reliance
// on Vercel's account-level Deployment Protection toggle, which offers no
// real safeguard once the app holds real bank data via the finance feature.
//
// The cookie itself only carries a signed *reference* (a random session id)
// to a row in the `sessions` table — actual validity (revoked? expired?) is
// always a live DB check. This is what makes single-session revocation
// possible: rotating SESSION_SECRET would still be the only way to kill
// every session at once, but killing one specific device's session (e.g. a
// lost phone) just means flipping that one row's `revoked` flag.
const COOKIE_NAME = "donna_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface SessionInfo {
  id: string;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  userAgent: string | null;
}

function sign(payload: string): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("Missing SESSION_SECRET in environment");
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

// The `sessions` table stores this instead of the raw random id — a DB-only
// leak (no SESSION_SECRET) already can't forge a cookie (the signature
// needs the secret), but it previously *could* hand an attacker every
// currently-valid plaintext session id, which becomes immediately usable
// the moment SESSION_SECRET leaks too, from a wholly separate compromise.
// Hashing means a DB leak alone never yields anything usable in
// combination with a later/different secret leak. The raw id (in the
// cookie, never persisted) is still what's needed to compute the HMAC
// signature — this only changes what's written to the `id` column.
function hashSessionId(id: string): string {
  return crypto.createHash("sha256").update(id).digest("hex");
}

function signCookieValue(sessionId: string): string {
  return `${sessionId}.${sign(sessionId)}`;
}

// Verifies the HMAC signature only — proves the id was minted by this
// server (not guessed/enumerated), not that the session is still valid.
// The actual validity check (exists, not revoked, not expired) is a
// separate DB lookup, so a forged id can never even reach the database.
function verifyCookieSignature(value: string | undefined): string | null {
  if (!value) return null;
  const dotIndex = value.lastIndexOf(".");
  if (dotIndex === -1) return null;
  const sessionId = value.slice(0, dotIndex);
  const signature = value.slice(dotIndex + 1);

  let expected: string;
  try {
    expected = sign(sessionId);
  } catch {
    return null;
  }

  const signatureBuf = Buffer.from(signature, "hex");
  const expectedBuf = Buffer.from(expected, "hex");
  if (signatureBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(signatureBuf, expectedBuf)) {
    return null;
  }
  return sessionId;
}

function parseCookies(header: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!header) return cookies;
  for (const part of header.split(";")) {
    const eqIndex = part.indexOf("=");
    if (eqIndex === -1) continue;
    const key = part.slice(0, eqIndex).trim();
    const value = part.slice(eqIndex + 1).trim();
    if (key) cookies[key] = decodeURIComponent(value);
  }
  return cookies;
}

// Unsigned lookup only — used wherever code just needs to know *which*
// session this request claims to be (e.g. to exclude it from a "sign out
// everywhere else" sweep), not whether it's actually still valid. Returns
// the *hashed* id (matching what's stored in the `sessions` table, see
// hashSessionId above) — every caller uses this purely to compare against
// or query that table, never to reconstruct the cookie.
export function getCurrentSessionId(req: VercelRequest): string | null {
  const cookies = parseCookies(req.headers.cookie);
  const rawId = verifyCookieSignature(cookies[COOKIE_NAME]);
  return rawId ? hashSessionId(rawId) : null;
}

// Vercel's local dev server (`vercel dev`) serves over plain http, where a
// Secure cookie is silently dropped by the browser (confirmed locally —
// vercel dev doesn't set VERCEL_ENV the way the docs imply, so gating on
// that env var never actually skipped Secure locally). Checking the
// request's own forwarded protocol is what actually distinguishes the
// two: Vercel's proxy sets x-forwarded-proto to "https" on every deployed
// request (preview and production alike), and it's absent/"http" locally.
function secureCookieFlag(req: VercelRequest): string {
  return req.headers["x-forwarded-proto"] === "https" ? "; Secure" : "";
}

export async function createSession(req: VercelRequest, res: VercelResponse): Promise<void> {
  const id = crypto.randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  const userAgent = typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : null;

  const client = getSupabaseClient();
  const { error } = await withSupabaseRetry(() =>
    client.from("sessions").insert({ id: hashSessionId(id), expires_at: expiresAt, user_agent: userAgent })
  );
  if (error) {
    throw new Error(`Supabase insert error: ${error.message}`);
  }

  const maxAgeSeconds = Math.floor(SESSION_TTL_MS / 1000);
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=${signCookieValue(id)}; Path=/; HttpOnly${secureCookieFlag(req)}; SameSite=Lax; Max-Age=${maxAgeSeconds}`
  );
}

// Revokes this request's own session (if any) and clears the cookie —
// the logout path. Distinct from revokeSession(id), which lets one
// session revoke a *different* one from Settings.
export async function destroySession(req: VercelRequest, res: VercelResponse): Promise<void> {
  const sessionId = getCurrentSessionId(req);
  if (sessionId) {
    const client = getSupabaseClient();
    await withSupabaseRetry(() => client.from("sessions").update({ revoked: true }).eq("id", sessionId)).catch(
      () => {}
    );
  }
  res.setHeader("Set-Cookie", `${COOKIE_NAME}=; Path=/; HttpOnly${secureCookieFlag(req)}; SameSite=Lax; Max-Age=0`);
}

export async function isAuthenticated(req: VercelRequest): Promise<boolean> {
  const sessionId = getCurrentSessionId(req);
  if (!sessionId) return false;

  const client = getSupabaseClient();
  const { data, error } = await withSupabaseRetry(() =>
    client.from("sessions").select("expires_at, revoked").eq("id", sessionId).maybeSingle()
  );
  if (error || !data) return false;
  if (data.revoked || new Date(data.expires_at).getTime() <= Date.now()) return false;

  // Best-effort last-seen touch — fire-and-forget, since a failure here
  // shouldn't fail the auth check itself (it's purely informational, for
  // the Settings page's session list).
  client
    .from("sessions")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", sessionId)
    .then(
      () => {},
      () => {}
    );

  return true;
}

export function verifyPassword(candidate: string): boolean {
  const actual = process.env.DASHBOARD_PASSWORD;
  if (!actual || !candidate) return false;
  const candidateBuf = Buffer.from(candidate);
  const actualBuf = Buffer.from(actual);
  if (candidateBuf.length !== actualBuf.length) return false;
  return crypto.timingSafeEqual(candidateBuf, actualBuf);
}

// Every page handler calls this first — redirects to the login page and
// returns false if there's no valid session, so the caller can just
// `if (!(await requireAuth(req, res))) return;`. Telegram's webhook and the
// cron/GitHub-Actions-triggered morning-brief endpoint deliberately don't
// use this — they're called by external services with no browser session
// at all, and are already gated by their own bearer-secret checks.
export async function requireAuth(req: VercelRequest, res: VercelResponse): Promise<boolean> {
  if (await isAuthenticated(req)) return true;
  res.redirect(303, "/donna/login");
  return false;
}

export async function listActiveSessions(): Promise<SessionInfo[]> {
  const client = getSupabaseClient();
  const { data, error } = await withSupabaseRetry(() =>
    client
      .from("sessions")
      .select("id, created_at, last_seen_at, expires_at, user_agent")
      .eq("revoked", false)
      .gt("expires_at", new Date().toISOString())
      .order("last_seen_at", { ascending: false })
  );
  if (error) {
    if (error.code === "PGRST205") return [];
    throw new Error(`Supabase read error: ${error.message}`);
  }
  return (data ?? []).map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at,
    expiresAt: row.expires_at,
    userAgent: row.user_agent,
  }));
}

export async function revokeSession(id: string): Promise<void> {
  const client = getSupabaseClient();
  const { error } = await withSupabaseRetry(() => client.from("sessions").update({ revoked: true }).eq("id", id));
  if (error) {
    throw new Error(`Supabase update error: ${error.message}`);
  }
}

export async function revokeOtherSessions(currentSessionId: string): Promise<void> {
  const client = getSupabaseClient();
  const { error } = await withSupabaseRetry(() =>
    client.from("sessions").update({ revoked: true }).neq("id", currentSessionId)
  );
  if (error) {
    throw new Error(`Supabase update error: ${error.message}`);
  }
}

// Called once daily from formatBrief.ts alongside every other prune —
// keeps this table from growing unbounded. A revoked-but-not-yet-expired
// row is harmless to leave around a little longer (isAuthenticated already
// rejects it), so this only needs to clear out ones past their TTL.
export async function pruneOldSessions(): Promise<void> {
  const client = getSupabaseClient();
  const { error } = await withSupabaseRetry(() =>
    client.from("sessions").delete().lt("expires_at", new Date().toISOString())
  );
  if (error && error.code !== "PGRST205") {
    throw new Error(`Supabase prune error: ${error.message}`);
  }
}
