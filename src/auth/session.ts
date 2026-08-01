import crypto from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";

// App-wide login gate: a single shared password (DASHBOARD_PASSWORD) and an
// HMAC-signed, HttpOnly session cookie (SESSION_SECRET) — replacing reliance
// on Vercel's account-level Deployment Protection toggle, which offers no
// real safeguard once the app holds real bank data via the finance feature.
const COOKIE_NAME = "donna_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function sign(payload: string): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("Missing SESSION_SECRET in environment");
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

function verifySessionCookieValue(value: string | undefined): boolean {
  if (!value) return false;
  const dotIndex = value.lastIndexOf(".");
  if (dotIndex === -1) return false;
  const payload = value.slice(0, dotIndex);
  const signature = value.slice(dotIndex + 1);

  let expected: string;
  try {
    expected = sign(payload);
  } catch {
    return false;
  }

  const signatureBuf = Buffer.from(signature, "hex");
  const expectedBuf = Buffer.from(expected, "hex");
  if (signatureBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(signatureBuf, expectedBuf)) {
    return false;
  }

  const expires = Number(payload);
  return Number.isFinite(expires) && expires > Date.now();
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

export function isAuthenticated(req: VercelRequest): boolean {
  const cookies = parseCookies(req.headers.cookie);
  return verifySessionCookieValue(cookies[COOKIE_NAME]);
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

export function setSessionCookie(req: VercelRequest, res: VercelResponse): void {
  const expires = Date.now() + SESSION_TTL_MS;
  const value = `${expires}.${sign(String(expires))}`;
  const maxAgeSeconds = Math.floor(SESSION_TTL_MS / 1000);
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=${value}; Path=/; HttpOnly${secureCookieFlag(req)}; SameSite=Lax; Max-Age=${maxAgeSeconds}`
  );
}

export function clearSessionCookie(req: VercelRequest, res: VercelResponse): void {
  res.setHeader("Set-Cookie", `${COOKIE_NAME}=; Path=/; HttpOnly${secureCookieFlag(req)}; SameSite=Lax; Max-Age=0`);
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
// `if (!requireAuth(req, res)) return;`. Telegram's webhook and the cron/
// GitHub-Actions-triggered morning-brief endpoint deliberately don't use
// this — they're called by external services with no browser session at
// all, and are already gated by their own bearer-secret checks.
export function requireAuth(req: VercelRequest, res: VercelResponse): boolean {
  if (isAuthenticated(req)) return true;
  res.redirect(303, "/donna/login");
  return false;
}
