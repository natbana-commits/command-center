import { getSupabaseClient, withSupabaseRetry } from "../supabaseClient.js";
import { encrypt, decrypt } from "./crypto.js";

export interface PlaidItem {
  id: number;
  itemId: string;
  institutionName: string;
  cursor: string | null;
  needsReauth: boolean;
  createdAt: string;
}

interface PlaidItemRow {
  id: number;
  item_id: string;
  institution_name: string;
  cursor: string | null;
  needs_reauth: boolean;
  created_at: string;
}

function rowToItem(row: PlaidItemRow): PlaidItem {
  return {
    id: row.id,
    itemId: row.item_id,
    institutionName: row.institution_name,
    cursor: row.cursor,
    needsReauth: row.needs_reauth,
    createdAt: row.created_at,
  };
}

const SELECT_COLUMNS = "id, item_id, institution_name, cursor, needs_reauth, created_at";

export async function saveItem(itemId: string, institutionName: string, accessToken: string): Promise<void> {
  const { ciphertext, iv } = encrypt(accessToken);
  const client = getSupabaseClient();
  const { error } = await withSupabaseRetry(() =>
    client.from("plaid_items").upsert(
      {
        item_id: itemId,
        institution_name: institutionName,
        access_token_encrypted: ciphertext,
        access_token_iv: iv,
      },
      { onConflict: "item_id" }
    )
  );
  if (error) {
    throw new Error(`Supabase insert error: ${error.message}`);
  }
}

export async function getAllItems(): Promise<PlaidItem[]> {
  const client = getSupabaseClient();
  const { data, error } = await withSupabaseRetry(() =>
    client.from("plaid_items").select(SELECT_COLUMNS).order("created_at", { ascending: true })
  );
  if (error) {
    if (error.code === "PGRST205") return [];
    throw new Error(`Supabase read error: ${error.message}`);
  }
  return (data ?? []).map(rowToItem);
}

export async function getDecryptedAccessToken(itemId: string): Promise<string> {
  const client = getSupabaseClient();
  const { data, error } = await withSupabaseRetry(() =>
    client.from("plaid_items").select("access_token_encrypted, access_token_iv").eq("item_id", itemId).maybeSingle()
  );
  if (error || !data) {
    throw new Error(`Supabase read error: ${error?.message ?? "item not found"}`);
  }
  return decrypt({ ciphertext: data.access_token_encrypted, iv: data.access_token_iv });
}

export async function updateCursor(itemId: string, cursor: string): Promise<void> {
  const client = getSupabaseClient();
  const { error } = await withSupabaseRetry(() =>
    client.from("plaid_items").update({ cursor }).eq("item_id", itemId)
  );
  if (error) {
    throw new Error(`Supabase update error: ${error.message}`);
  }
}

export async function setNeedsReauth(itemId: string, needsReauth: boolean): Promise<void> {
  const client = getSupabaseClient();
  const { error } = await withSupabaseRetry(() =>
    client.from("plaid_items").update({ needs_reauth: needsReauth }).eq("item_id", itemId)
  );
  if (error) {
    throw new Error(`Supabase update error: ${error.message}`);
  }
}

export async function deleteItem(itemId: string): Promise<void> {
  const client = getSupabaseClient();
  const { error } = await withSupabaseRetry(() => client.from("plaid_items").delete().eq("item_id", itemId));
  if (error) {
    throw new Error(`Supabase delete error: ${error.message}`);
  }
}
