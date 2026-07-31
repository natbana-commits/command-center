import { getSupabaseClient } from "../supabaseClient.js";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function getChatHistory(day: string): Promise<ChatMessage[]> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from("chat_messages")
    .select("role, content")
    .eq("day", day)
    .order("created_at", { ascending: true })
    .limit(60);

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
  const { error } = await client.from("chat_messages").insert({ day, role, content });

  if (error) {
    throw new Error(`Supabase insert error: ${error.message}`);
  }
}
