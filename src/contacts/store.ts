import { getSupabaseClient, withSupabaseRetry } from "../supabaseClient.js";

export interface Contact {
  id: number;
  name: string;
  firm: string | null;
  notes: string | null;
  lastContactedAt: string | null;
  bio: string | null;
  relationshipTag: string | null;
}

export interface ContactInteraction {
  id: number;
  contactId: number;
  interactionType: string;
  notes: string | null;
  occurredAt: string;
}

function rowToContact(row: {
  id: number;
  name: string;
  firm: string | null;
  notes: string | null;
  last_contacted_at: string | null;
  bio: string | null;
  relationship_tag: string | null;
}): Contact {
  return {
    id: row.id,
    name: row.name,
    firm: row.firm,
    notes: row.notes,
    lastContactedAt: row.last_contacted_at,
    bio: row.bio,
    relationshipTag: row.relationship_tag,
  };
}

function rowToInteraction(row: {
  id: number;
  contact_id: number;
  interaction_type: string;
  notes: string | null;
  occurred_at: string;
}): ContactInteraction {
  return {
    id: row.id,
    contactId: row.contact_id,
    interactionType: row.interaction_type,
    notes: row.notes,
    occurredAt: row.occurred_at,
  };
}

export async function getContacts(): Promise<Contact[]> {
  const client = getSupabaseClient();
  const { data, error } = await withSupabaseRetry(() =>
    client
      .from("contacts")
      .select("id, name, firm, notes, last_contacted_at, bio, relationship_tag")
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
  bio?: string;
  relationshipTag?: string;
}): Promise<void> {
  const client = getSupabaseClient();
  const { error } = await withSupabaseRetry(() =>
    client.from("contacts").insert({
      name: fields.name,
      firm: fields.firm || null,
      notes: fields.notes || null,
      last_contacted_at: fields.lastContactedAt || null,
      bio: fields.bio || null,
      relationship_tag: fields.relationshipTag || null,
    })
  );

  if (error) {
    throw new Error(`Supabase insert error: ${error.message}`);
  }
}

export async function updateContact(
  id: number,
  fields: {
    name: string;
    firm?: string;
    notes?: string;
    lastContactedAt?: string;
    bio?: string;
    relationshipTag?: string;
  }
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
        bio: fields.bio || null,
        relationship_tag: fields.relationshipTag || null,
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

export async function getInteractionsForContact(contactId: number): Promise<ContactInteraction[]> {
  const client = getSupabaseClient();
  const { data, error } = await withSupabaseRetry(() =>
    client
      .from("contact_interactions")
      .select("id, contact_id, interaction_type, notes, occurred_at")
      .eq("contact_id", contactId)
      .order("occurred_at", { ascending: false })
  );

  if (error) {
    if (error.code === "PGRST205") return [];
    throw new Error(`Supabase read error: ${error.message}`);
  }

  return (data ?? []).map(rowToInteraction);
}

// Logs a new interaction and bumps the parent contact's last_contacted_at
// forward (never back) so "time since contact" stays accurate regardless
// of whether it came from the manual field or a logged interaction.
export async function addInteraction(
  contactId: number,
  fields: { interactionType: string; notes?: string; occurredAt: string }
): Promise<void> {
  const client = getSupabaseClient();
  const { error } = await withSupabaseRetry(() =>
    client.from("contact_interactions").insert({
      contact_id: contactId,
      interaction_type: fields.interactionType,
      notes: fields.notes || null,
      occurred_at: fields.occurredAt,
    })
  );

  if (error) {
    throw new Error(`Supabase insert error: ${error.message}`);
  }

  const { data: contact, error: readError } = await withSupabaseRetry(() =>
    client.from("contacts").select("last_contacted_at").eq("id", contactId).maybeSingle()
  );
  if (readError) {
    throw new Error(`Supabase read error: ${readError.message}`);
  }

  const current = contact?.last_contacted_at as string | null | undefined;
  if (!current || fields.occurredAt > current) {
    const { error: updateError } = await withSupabaseRetry(() =>
      client.from("contacts").update({ last_contacted_at: fields.occurredAt }).eq("id", contactId)
    );
    if (updateError) {
      throw new Error(`Supabase update error: ${updateError.message}`);
    }
  }
}

export async function deleteInteraction(id: number): Promise<void> {
  const client = getSupabaseClient();
  const { error } = await withSupabaseRetry(() => client.from("contact_interactions").delete().eq("id", id));

  if (error) {
    throw new Error(`Supabase delete error: ${error.message}`);
  }
}
