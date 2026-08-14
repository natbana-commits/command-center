// Personal-use OAuth, shared across Gmail, Drive, Tasks, and Calendar: a
// refresh token generated once (manually, via the Google OAuth consent
// flow, requesting gmail.readonly, drive.readonly, tasks, and
// calendar.events scopes on one client) is exchanged here for a
// short-lived access token. No interactive browser step at runtime.
//
// Cached at module scope (persists across requests on the same warm
// serverless container, same idiom as plaidClient.ts's cachedClient) —
// this used to hit oauth2.googleapis.com on every single call, and there
// are a dozen call sites across Tasks/Calendar/Drive/Gmail, several of
// which fire more than once in a single page render.
let cachedToken: { accessToken: string; expiresAt: number } | null = null;

export async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.accessToken;
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "Missing GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, or GOOGLE_REFRESH_TOKEN in environment"
    );
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    // A stale cached token that Google has since rejected shouldn't keep
    // getting retried on every call until the container recycles.
    cachedToken = null;
    throw new Error(`Google token refresh error ${response.status}: ${body}`);
  }

  const data = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) {
    cachedToken = null;
    throw new Error("Google token refresh response missing access_token");
  }

  // Google access tokens are typically valid for 3600s; refresh a minute
  // early so a token doesn't expire mid-request.
  const ttlSeconds = (data.expires_in ?? 3600) - 60;
  cachedToken = { accessToken: data.access_token, expiresAt: Date.now() + ttlSeconds * 1000 };
  return data.access_token;
}

// True only when all three secrets are present — lets callers skip Gmail
// or Drive features gracefully until OAuth setup is complete, instead of
// throwing and breaking the rest of the brief/page.
export function isGoogleConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REFRESH_TOKEN
  );
}
