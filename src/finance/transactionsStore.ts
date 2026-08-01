import { getSupabaseClient, withSupabaseRetry } from "../supabaseClient.js";

export interface PlaidTransaction {
  id: number;
  transactionId: string;
  accountId: string;
  amount: number;
  isoCurrencyCode: string | null;
  name: string;
  merchantName: string | null;
  category: string | null;
  pending: boolean;
  transactionDate: string;
}

interface PlaidTransactionRow {
  id: number;
  transaction_id: string;
  account_id: string;
  amount: number;
  iso_currency_code: string | null;
  name: string;
  merchant_name: string | null;
  category: string | null;
  pending: boolean;
  transaction_date: string;
}

function rowToTransaction(row: PlaidTransactionRow): PlaidTransaction {
  return {
    id: row.id,
    transactionId: row.transaction_id,
    accountId: row.account_id,
    amount: row.amount,
    isoCurrencyCode: row.iso_currency_code,
    name: row.name,
    merchantName: row.merchant_name,
    category: row.category,
    pending: row.pending,
    transactionDate: row.transaction_date,
  };
}

const SELECT_COLUMNS =
  "id, transaction_id, account_id, amount, iso_currency_code, name, merchant_name, category, pending, transaction_date";

export interface TransactionUpsertInput {
  transactionId: string;
  accountId: string;
  amount: number;
  isoCurrencyCode?: string | null;
  name: string;
  merchantName?: string | null;
  category?: string | null;
  pending: boolean;
  transactionDate: string;
}

export async function upsertTransactions(transactions: TransactionUpsertInput[]): Promise<void> {
  if (transactions.length === 0) return;
  const client = getSupabaseClient();
  const { error } = await withSupabaseRetry(() =>
    client.from("plaid_transactions").upsert(
      transactions.map((t) => ({
        transaction_id: t.transactionId,
        account_id: t.accountId,
        amount: t.amount,
        iso_currency_code: t.isoCurrencyCode ?? null,
        name: t.name,
        merchant_name: t.merchantName ?? null,
        category: t.category ?? null,
        pending: t.pending,
        transaction_date: t.transactionDate,
      })),
      { onConflict: "transaction_id" }
    )
  );
  if (error) {
    throw new Error(`Supabase upsert error: ${error.message}`);
  }
}

export async function deleteTransactions(transactionIds: string[]): Promise<void> {
  if (transactionIds.length === 0) return;
  const client = getSupabaseClient();
  const { error } = await withSupabaseRetry(() =>
    client.from("plaid_transactions").delete().in("transaction_id", transactionIds)
  );
  if (error) {
    throw new Error(`Supabase delete error: ${error.message}`);
  }
}

export async function getRecentTransactions(limit = 50): Promise<PlaidTransaction[]> {
  const client = getSupabaseClient();
  const { data, error } = await withSupabaseRetry(() =>
    client
      .from("plaid_transactions")
      .select(SELECT_COLUMNS)
      .order("transaction_date", { ascending: false })
      .limit(limit)
  );
  if (error) {
    if (error.code === "PGRST205") return [];
    throw new Error(`Supabase read error: ${error.message}`);
  }
  return (data ?? []).map(rowToTransaction);
}
