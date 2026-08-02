import { getSupabaseClient, withSupabaseRetry } from "../supabaseClient.js";
import { getAllAccounts } from "./accounts.js";
import { syncAllItems } from "./sync.js";
import { localDateKey } from "../util/time.js";

export interface NetWorthPoint {
  date: string;
  netWorth: number;
}

// "credit"/"loan" balances are debt, not assets — everything else
// (depository, investment, etc.) counts toward net worth as-is. Matches
// financesPage.ts's own totalCash/totalCredit split.
function isLiabilityType(type: string): boolean {
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
