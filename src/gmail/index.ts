import { isGoogleConfigured } from "../google/auth.js";
import { fetchNewsletters, type NewsletterEmail } from "./fetch.js";
import { storeNewsletters } from "./store.js";

// Safe to call unconditionally: returns an empty array (no throw) until
// GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET/GOOGLE_REFRESH_TOKEN are configured,
// so wiring this into the daily brief can't break the rest of it. Also safe
// to call more than once a day — storeNewsletters upserts by id and keys
// each row by its own receivedAt, so a repeat fetch just re-confirms
// already-stored newsletters and picks up any new ones since the last call.
export async function fetchAndStoreNewsletters(
  timezone: string,
  query: string
): Promise<NewsletterEmail[]> {
  if (!isGoogleConfigured()) {
    return [];
  }

  const newsletters = await fetchNewsletters(query);
  await storeNewsletters(newsletters, timezone);
  return newsletters;
}

export { getNewslettersForDay, pruneOldNewsletters } from "./store.js";
