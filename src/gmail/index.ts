import { isGmailConfigured } from "./auth.js";
import { fetchNewsletters, type NewsletterEmail } from "./fetch.js";
import { storeNewsletters } from "./store.js";

const DEFAULT_QUERY = "newer_than:2d label:newsletters";

// Safe to call unconditionally: returns an empty array (no throw) until
// GMAIL_CLIENT_ID/GMAIL_CLIENT_SECRET/GMAIL_REFRESH_TOKEN are configured, so
// wiring this into the daily brief can't break the rest of it.
export async function fetchAndStoreNewsletters(day: string, query?: string): Promise<NewsletterEmail[]> {
  if (!isGmailConfigured()) {
    return [];
  }

  const newsletters = await fetchNewsletters(query ?? process.env.GMAIL_NEWSLETTER_QUERY ?? DEFAULT_QUERY);
  await storeNewsletters(day, newsletters);
  return newsletters;
}

export { getNewslettersForDay } from "./store.js";
