import { getSupabaseClient, withSupabaseRetry } from "../supabaseClient.js";

export interface PlaidAccount {
  id: number;
  itemId: string;
  accountId: string;
  name: string;
  officialName: string | null;
  type: string;
  subtype: string | null;
  mask: string | null;
  currentBalance: number | null;
  availableBalance: number | null;
  isoCurrencyCode: string | null;
  updatedAt: string;
}

interface PlaidAccountRow {
  id: number;
  item_id: string;
  account_id: string;
  name: string;
  official_name: string | null;
  type: string;
  subtype: string | null;
  mask: string | null;
  current_balance: number | null;
  available_balance: number | null;
  iso_currency_code: string | null;
  updated_at: string;
}

function rowToAccount(row: PlaidAccountRow): PlaidAccount {
  return {
    id: row.id,
    itemId: row.item_id,
    accountId: row.account_id,
    name: row.name,
    officialName: row.official_name,
    type: row.type,
    subtype: row.subtype,
    mask: row.mask,
    currentBalance: row.current_balance,
    availableBalance: row.available_balance,
    isoCurrencyCode: row.iso_currency_code,
    updatedAt: row.updated_at,
  };
}

const SELECT_COLUMNS =
  "id, item_id, account_id, name, official_name, type, subtype, mask, current_balance, available_balance, iso_currency_code, updated_at";

export interface AccountUpsertInput {
  accountId: string;
  itemId: string;
  name: string;
  officialName?: string | null;
  type: string;
  subtype?: string | null;
  mask?: string | null;
  currentBalance?: number | null;
  availableBalance?: number | null;
  isoCurrencyCode?: string | null;
}

export async function upsertAccounts(accounts: AccountUpsertInput[]): Promise<void> {
  if (accounts.length === 0) return;
  const client = getSupabaseClient();
  const { error } = await withSupabaseRetry(() =>
    client.from("plaid_accounts").upsert(
      accounts.map((a) => ({
        account_id: a.accountId,
        item_id: a.itemId,
        name: a.name,
        official_name: a.officialName ?? null,
        type: a.type,
        subtype: a.subtype ?? null,
        mask: a.mask ?? null,
        current_balance: a.currentBalance ?? null,
        available_balance: a.availableBalance ?? null,
        iso_currency_code: a.isoCurrencyCode ?? null,
        updated_at: new Date().toISOString(),
      })),
      { onConflict: "account_id" }
    )
  );
  if (error) {
    throw new Error(`Supabase upsert error: ${error.message}`);
  }
}

export async function getAllAccounts(): Promise<PlaidAccount[]> {
  const client = getSupabaseClient();
  const { data, error } = await withSupabaseRetry(() =>
    client.from("plaid_accounts").select(SELECT_COLUMNS).order("name", { ascending: true })
  );
  if (error) {
    if (error.code === "PGRST205") return [];
    throw new Error(`Supabase read error: ${error.message}`);
  }
  return (data ?? []).map(rowToAccount);
}
