import { getSupabaseClient, withSupabaseRetry } from "../supabaseClient.js";

// For bills Plaid can't see (rent paid by check/Venmo, a card not linked
// here, etc.) — a fixed monthly amount due on the same day each month,
// entered by hand rather than detected from transactions.
export interface ManualBill {
  id: number;
  name: string;
  amount: number;
  dueDay: number; // 1-31
}

export async function getManualBills(): Promise<ManualBill[]> {
  const client = getSupabaseClient();
  const { data, error } = await withSupabaseRetry(() =>
    client.from("manual_bills").select("id, name, amount, due_day").order("due_day", { ascending: true })
  );

  if (error) {
    if (error.code === "PGRST205") return [];
    throw new Error(`Supabase read error: ${error.message}`);
  }
  return (data ?? []).map((row) => ({ id: row.id, name: row.name, amount: row.amount, dueDay: row.due_day }));
}

export async function addManualBill(name: string, amount: number, dueDay: number): Promise<void> {
  const client = getSupabaseClient();
  const { error } = await withSupabaseRetry(() =>
    client.from("manual_bills").insert({ name, amount, due_day: dueDay })
  );

  if (error) {
    throw new Error(`Supabase insert error: ${error.message}`);
  }
}

export async function updateManualBill(id: number, name: string, amount: number, dueDay: number): Promise<void> {
  const client = getSupabaseClient();
  const { error } = await withSupabaseRetry(() =>
    client.from("manual_bills").update({ name, amount, due_day: dueDay }).eq("id", id)
  );

  if (error) {
    throw new Error(`Supabase update error: ${error.message}`);
  }
}

export async function deleteManualBill(id: number): Promise<void> {
  const client = getSupabaseClient();
  const { error } = await withSupabaseRetry(() => client.from("manual_bills").delete().eq("id", id));

  if (error) {
    throw new Error(`Supabase delete error: ${error.message}`);
  }
}
