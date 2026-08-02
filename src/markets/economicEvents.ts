import { getSupabaseClient, withSupabaseRetry } from "../supabaseClient.js";
import { localDateKey } from "../util/time.js";

export interface EconomicEvent {
  id: number;
  eventName: string;
  eventDate: string;
  category: string;
}

function rowToEvent(row: { id: number; event_name: string; event_date: string; category: string }): EconomicEvent {
  return { id: row.id, eventName: row.event_name, eventDate: row.event_date, category: row.category };
}

export async function getUpcomingEconomicEvents(limit = 5): Promise<EconomicEvent[]> {
  const client = getSupabaseClient();
  const today = localDateKey(new Date(), "UTC");
  const { data, error } = await withSupabaseRetry(() =>
    client
      .from("economic_events")
      .select("id, event_name, event_date, category")
      .gte("event_date", today)
      .order("event_date", { ascending: true })
      .limit(limit)
  );

  if (error) {
    if (error.code === "PGRST205") return [];
    throw new Error(`Supabase read error: ${error.message}`);
  }
  return (data ?? []).map(rowToEvent);
}

// Used by formatBrief.ts for the same-day/next-day morning-brief callout —
// a narrower window than getUpcomingEconomicEvents's "next few" list.
export async function getEconomicEventsInWindow(startDateKey: string, endDateKey: string): Promise<EconomicEvent[]> {
  const client = getSupabaseClient();
  const { data, error } = await withSupabaseRetry(() =>
    client
      .from("economic_events")
      .select("id, event_name, event_date, category")
      .gte("event_date", startDateKey)
      .lte("event_date", endDateKey)
      .order("event_date", { ascending: true })
  );

  if (error) {
    if (error.code === "PGRST205") return [];
    throw new Error(`Supabase read error: ${error.message}`);
  }
  return (data ?? []).map(rowToEvent);
}
