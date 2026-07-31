import { getSupabaseClient, withSupabaseRetry } from "../supabaseClient.js";

const RETENTION_DAYS = 30;

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function getChatHistory(day: string): Promise<ChatMessage[]> {
  const client = getSupabaseClient();
  const { data, error } = await withSupabaseRetry(() =>
    client
      .from("chat_messages")
      .select("role, content")
      .eq("day", day)
      .order("created_at", { ascending: true })
      .limit(60)
  );

  if (error) {
    throw new Error(`Supabase read error: ${error.message}`);
  }

  return (data ?? []) as ChatMessage[];
}

export async function appendChatMessage(
  day: string,
  role: "user" | "assistant",
  content: string
): Promise<void> {
  const client = getSupabaseClient();
  const { error } = await withSupabaseRetry(() =>
    client.from("chat_messages").insert({ day, role, content })
  );

  if (error) {
    throw new Error(`Supabase insert error: ${error.message}`);
  }
}

export async function pruneOldChatMessages(): Promise<void> {
  const client = getSupabaseClient();
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const { error } = await withSupabaseRetry(() =>
    client.from("chat_messages").delete().lt("day", cutoff)
  );

  if (error) {
    throw new Error(`Supabase prune error: ${error.message}`);
  }
}
