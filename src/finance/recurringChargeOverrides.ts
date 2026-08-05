import { getSupabaseClient, withSupabaseRetry } from "../supabaseClient.js";
import type { RecurringCharge } from "./recurringCharges.js";

// One row per merchant that's ever been edited or dismissed — not one row
// per detected charge, since charges themselves aren't persisted (see
// recurringCharges.ts). Absence of a row means "no override," not "not
// recurring."
export interface RecurringChargeOverride {
  merchantKey: string;
  displayName: string | null;
  amountOverride: number | null;
  dismissed: boolean;
}

export async function getRecurringChargeOverrides(): Promise<RecurringChargeOverride[]> {
  const client = getSupabaseClient();
  const { data, error } = await withSupabaseRetry(() =>
    client.from("recurring_charge_overrides").select("merchant_key, display_name, amount_override, dismissed")
  );

  if (error) {
    if (error.code === "PGRST205") return [];
    throw new Error(`Supabase read error: ${error.message}`);
  }
  return (data ?? []).map((row) => ({
    merchantKey: row.merchant_key,
    displayName: row.display_name,
    amountOverride: row.amount_override,
    dismissed: row.dismissed,
  }));
}

// Upserts whichever fields are passed — a dismiss action only sets
// `dismissed`, an edit only sets `displayName`/`amountOverride`, so this
// merges onto any existing row rather than requiring the caller to supply
// every field every time.
export async function upsertRecurringChargeOverride(
  merchantKey: string,
  fields: { displayName?: string | null; amountOverride?: number | null; dismissed?: boolean }
): Promise<void> {
  const client = getSupabaseClient();
  const { data: existing } = await withSupabaseRetry(() =>
    client.from("recurring_charge_overrides").select("display_name, amount_override, dismissed").eq("merchant_key", merchantKey).maybeSingle()
  );

  const { error } = await withSupabaseRetry(() =>
    client.from("recurring_charge_overrides").upsert(
      {
        merchant_key: merchantKey,
        display_name: fields.displayName !== undefined ? fields.displayName : (existing?.display_name ?? null),
        amount_override: fields.amountOverride !== undefined ? fields.amountOverride : (existing?.amount_override ?? null),
        dismissed: fields.dismissed !== undefined ? fields.dismissed : (existing?.dismissed ?? false),
      },
      { onConflict: "merchant_key" }
    )
  );

  if (error) {
    throw new Error(`Supabase upsert error: ${error.message}`);
  }
}

// Filters out dismissed merchants and applies a rename/amount correction
// to the rest — called right after detectRecurringCharges(), before the
// result reaches either the Recurring Charges widget or
// buildUpcomingPayments (so a dismissal disappears from both, not just
// its own widget).
export function applyRecurringChargeOverrides(
  charges: RecurringCharge[],
  overrides: RecurringChargeOverride[]
): RecurringCharge[] {
  const byKey = new Map(overrides.map((o) => [o.merchantKey, o]));
  return charges
    .filter((c) => !byKey.get(c.merchantKey)?.dismissed)
    .map((c) => {
      const override = byKey.get(c.merchantKey);
      if (!override) return c;
      return {
        ...c,
        label: override.displayName ?? c.label,
        averageAmount: override.amountOverride ?? c.averageAmount,
      };
    });
}

// Clears an override back to the raw detected values entirely (distinct
// from un-dismissing, which keeps a rename/amount-correction in place —
// this is "forget everything about this merchant").
export async function deleteRecurringChargeOverride(merchantKey: string): Promise<void> {
  const client = getSupabaseClient();
  const { error } = await withSupabaseRetry(() =>
    client.from("recurring_charge_overrides").delete().eq("merchant_key", merchantKey)
  );

  if (error) {
    throw new Error(`Supabase delete error: ${error.message}`);
  }
}
