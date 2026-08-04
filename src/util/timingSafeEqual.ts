import crypto from "node:crypto";

// A plain !== leaks how many leading characters of a guessed secret were
// correct via response-time variance — negligible practically for a
// personal app behind these endpoints, but src/auth/session.ts already
// uses crypto.timingSafeEqual for the password/cookie-signature checks,
// so the handful of other secret comparisons (webhook/cron bearer tokens)
// match that same standard rather than being the odd one out.
export function timingSafeStringEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}
