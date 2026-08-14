import { getSupabaseClient, withSupabaseRetry } from "../supabaseClient.js";
import { getAllAccounts } from "./accounts.js";
import { syncAllItems } from "./sync.js";
import { localDateKey } from "../util/time.js";

export interface NetWorthPoint {
  date: string;
  netWorth: number;
}

export interface BalancePoint {
  date: string;
  balance: number;
}

export type BalanceGranularity = "day" | "week" | "month" | "year";

// "credit"/"loan" balances are debt, not assets — everything else
// (depository, investment, etc.) counts toward net worth as-is. Matches
// financesPage.ts's own totalCash/totalCredit split.
export function isLiabilityType(type: string): boolean {
  return type === "credit" || type === "loan";
}

// Called once daily from the morning-brief cron. Re-syncs first so the
// snapshot reflects today's actual balances rather than whatever was last
// cached from a webhook (which only fires on new transaction activity, not
// on a fixed daily schedule) — upserted on (account_id, snapshot_date), so
// running this twice in one day just overwrites rather than duplicating.
export async function snapshotAccountBalances(): Promise<void> {
  await syncAllItems().catch((err) => {
    console.error("Balance snapshot: sync failed, snapshotting last-known balances instead:", err);
  });

  const accounts = await getAllAccounts();
  const rows = accounts
    .filter((a) => a.currentBalance !== null)
    .map((a) => ({
      account_id: a.accountId,
      balance: a.currentBalance,
      is_liability: isLiabilityType(a.type),
      snapshot_date: localDateKey(new Date(), "UTC"),
    }));
  if (rows.length === 0) return;

  const client = getSupabaseClient();
  const { error } = await withSupabaseRetry(() =>
    client.from("account_balance_history").upsert(rows, { onConflict: "account_id,snapshot_date" })
  );
  if (error) {
    throw new Error(`Supabase upsert error: ${error.message}`);
  }
}

export async function getNetWorthHistory(days = 90): Promise<NetWorthPoint[]> {
  const client = getSupabaseClient();
  const cutoff = localDateKey(new Date(Date.now() - days * 24 * 60 * 60 * 1000), "UTC");
  const { data, error } = await withSupabaseRetry(() =>
    client
      .from("account_balance_history")
      .select("balance, is_liability, snapshot_date")
      .gte("snapshot_date", cutoff)
      .order("snapshot_date", { ascending: true })
  );

  if (error) {
    if (error.code === "PGRST205") return [];
    throw new Error(`Supabase read error: ${error.message}`);
  }

  const byDate = new Map<string, number>();
  for (const row of data ?? []) {
    const signed = row.is_liability ? -row.balance : row.balance;
    byDate.set(row.snapshot_date, (byDate.get(row.snapshot_date) ?? 0) + signed);
  }

  return [...byDate.entries()].map(([date, netWorth]) => ({ date, netWorth })).sort((a, b) => a.date.localeCompare(b.date));
}

// Same table as getNetWorthHistory, just scoped to one account instead of
// summed across all of them — used for the per-account drill-down view
// (mainly investment accounts, where "balance over time" is the point;
// bank accounts show recent transactions instead, see financesPage.ts).
// Defaults to a year rather than getNetWorthHistory's 90 days since this
// is the only place month/year granularity views draw from.
export async function getAccountBalanceHistory(accountId: string, days = 365): Promise<BalancePoint[]> {
  const client = getSupabaseClient();
  const cutoff = localDateKey(new Date(Date.now() - days * 24 * 60 * 60 * 1000), "UTC");
  const { data, error } = await withSupabaseRetry(() =>
    client
      .from("account_balance_history")
      .select("balance, snapshot_date")
      .eq("account_id", accountId)
      .gte("snapshot_date", cutoff)
      .order("snapshot_date", { ascending: true })
  );

  if (error) {
    if (error.code === "PGRST205") return [];
    throw new Error(`Supabase read error: ${error.message}`);
  }

  return (data ?? []).map((row) => ({ date: row.snapshot_date, balance: row.balance }));
}

// Collapses daily snapshots into one point per week/month/year — the last
// snapshot within each bucket, since a balance is a point-in-time value,
// not something that makes sense to sum or average across days the way a
// spending total would. "day" is a no-op passthrough (already daily).
export function bucketBalancePoints(points: BalancePoint[], granularity: BalanceGranularity): BalancePoint[] {
  if (granularity === "day" || points.length === 0) return points;

  function bucketKey(dateKey: string): string {
    if (granularity === "year") return dateKey.slice(0, 4);
    if (granularity === "month") return dateKey.slice(0, 7);
    // Week: bucketed to that week's Sunday, matching the calendar/week-view
    // convention already used elsewhere in this app.
    const d = new Date(`${dateKey}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - d.getUTCDay());
    return d.toISOString().slice(0, 10);
  }

  // Points arrive sorted ascending, so the last write for a given bucket
  // key in this loop is always the chronologically-last point in it.
  const byBucket = new Map<string, BalancePoint>();
  for (const p of points) {
    byBucket.set(bucketKey(p.date), p);
  }
  return [...byBucket.values()].sort((a, b) => a.date.localeCompare(b.date));
}
