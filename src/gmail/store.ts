import { getSupabaseClient, withSupabaseRetry } from "../supabaseClient.js";
import { localDateKey } from "../util/time.js";
import type { NewsletterEmail } from "./fetch.js";

const RETENTION_DAYS = 30;

export interface StoredNewsletter {
  id: string;
  day: string;
  subject: string;
  sender: string;
  receivedAt: string;
  html: string;
}

export async function storeNewsletters(newsletters: NewsletterEmail[], timezone: string): Promise<void> {
  if (newsletters.length === 0) return;

  const client = getSupabaseClient();
  // Each newsletter's own receivedAt decides its day — not "whenever this
  // fetch happened to run". The search query is a rolling 2-day window
  // (newer_than:2d), so the same still-in-range newsletter gets refetched
  // and re-upserted (by id) on every run; stamping it with a single shared
  // "today" value here used to flip an already-correctly-dated newsletter
  // from yesterday over to today on the next run.
  const rows = newsletters.map((n) => ({
    id: n.id,
    day: localDateKey(n.receivedAt, timezone),
    subject: n.subject,
    sender: n.sender,
    received_at: n.receivedAt.toISOString(),
    html: n.html,
  }));

  const { error } = await withSupabaseRetry(() =>
    client.from("newsletters").upsert(rows, { onConflict: "id" })
  );
  if (error) {
    throw new Error(`Supabase upsert error: ${error.message}`);
  }
}

export async function getNewslettersForDay(day: string): Promise<StoredNewsletter[]> {
  const client = getSupabaseClient();
  const { data, error } = await withSupabaseRetry(() =>
    client
      .from("newsletters")
      .select("id, day, subject, sender, received_at, html")
      .eq("day", day)
      .order("received_at", { ascending: false })
  );

  if (error) {
    // The newsletters table is optional infrastructure — until it's created
    // (or Gmail is configured), the page should just show no newsletters
    // rather than fail entirely.
    if (error.code === "PGRST205") {
      return [];
    }
    throw new Error(`Supabase read error: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    day: row.day,
    subject: row.subject,
    sender: row.sender,
    receivedAt: row.received_at,
    html: row.html,
  }));
}

// Only today's newsletters ever get shown (getNewslettersForDay), so
// anything older is dead weight — each row carries a full HTML body,
// often 50-90KB.
export async function pruneOldNewsletters(): Promise<void> {
  const client = getSupabaseClient();
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const { error } = await withSupabaseRetry(() => client.from("newsletters").delete().lt("day", cutoff));

  if (error) {
    if (error.code === "PGRST205") return;
    throw new Error(`Supabase prune error: ${error.message}`);
  }
}
