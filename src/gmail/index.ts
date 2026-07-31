import { isGoogleConfigured } from "../google/auth.js";
import { fetchNewsletters, type NewsletterEmail } from "./fetch.js";
import { storeNewsletters } from "./store.js";

// Safe to call unconditionally: returns an empty array (no throw) until
// GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET/GOOGLE_REFRESH_TOKEN are configured,
// so wiring this into the daily brief can't break the rest of it.
export async function fetchAndStoreNewsletters(
  day: string,
  query: string
): Promise<NewsletterEmail[]> {
  if (!isGoogleConfigured()) {
    return [];
  }

  const newsletters = await fetchNewsletters(query);
  await storeNewsletters(day, newsletters);
  return newsletters;
}

export { getNewslettersForDay } from "./store.js";
