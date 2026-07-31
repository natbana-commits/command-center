import { getSupabaseClient } from "../supabaseClient.js";
import type { NewsletterEmail } from "./fetch.js";

export interface StoredNewsletter {
  id: string;
  day: string;
  subject: string;
  sender: string;
  receivedAt: string;
  html: string;
}

export async function storeNewsletters(day: string, newsletters: NewsletterEmail[]): Promise<void> {
  if (newsletters.length === 0) return;

  const client = getSupabaseClient();
  const rows = newsletters.map((n) => ({
    id: n.id,
    day,
    subject: n.subject,
    sender: n.sender,
    received_at: n.receivedAt.toISOString(),
    html: n.html,
  }));

  const { error } = await client.from("newsletters").upsert(rows, { onConflict: "id" });
  if (error) {
    throw new Error(`Supabase upsert error: ${error.message}`);
  }
}

export async function getNewslettersForDay(day: string): Promise<StoredNewsletter[]> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from("newsletters")
    .select("id, day, subject, sender, received_at, html")
    .eq("day", day)
    .order("received_at", { ascending: false });

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
