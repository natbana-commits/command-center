import { getSupabaseClient, withSupabaseRetry } from "../supabaseClient.js";

export interface Contact {
  id: number;
  name: string;
  firm: string | null;
  notes: string | null;
  lastContactedAt: string | null;
}

function rowToContact(row: {
  id: number;
  name: string;
  firm: string | null;
  notes: string | null;
  last_contacted_at: string | null;
}): Contact {
  return {
    id: row.id,
    name: row.name,
    firm: row.firm,
    notes: row.notes,
    lastContactedAt: row.last_contacted_at,
  };
}

export async function getContacts(): Promise<Contact[]> {
  const client = getSupabaseClient();
  const { data, error } = await withSupabaseRetry(() =>
    client
      .from("contacts")
      .select("id, name, firm, notes, last_contacted_at")
      .order("name", { ascending: true })
  );

  if (error) {
    if (error.code === "PGRST205") return [];
    throw new Error(`Supabase read error: ${error.message}`);
  }

  return (data ?? []).map(rowToContact);
}

export async function addContact(fields: {
  name: string;
  firm?: string;
  notes?: string;
  lastContactedAt?: string;
}): Promise<void> {
  const client = getSupabaseClient();
  const { error } = await withSupabaseRetry(() =>
    client.from("contacts").insert({
      name: fields.name,
      firm: fields.firm || null,
      notes: fields.notes || null,
      last_contacted_at: fields.lastContactedAt || null,
    })
  );

  if (error) {
    throw new Error(`Supabase insert error: ${error.message}`);
  }
}

export async function updateContact(
  id: number,
  fields: { name: string; firm?: string; notes?: string; lastContactedAt?: string }
): Promise<void> {
  const client = getSupabaseClient();
  const { error } = await withSupabaseRetry(() =>
    client
      .from("contacts")
      .update({
        name: fields.name,
        firm: fields.firm || null,
        notes: fields.notes || null,
        last_contacted_at: fields.lastContactedAt || null,
      })
      .eq("id", id)
  );

  if (error) {
    throw new Error(`Supabase update error: ${error.message}`);
  }
}

export async function deleteContact(id: number): Promise<void> {
  const client = getSupabaseClient();
  const { error } = await withSupabaseRetry(() => client.from("contacts").delete().eq("id", id));

  if (error) {
    throw new Error(`Supabase delete error: ${error.message}`);
  }
}
