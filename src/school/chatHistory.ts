import { getSupabaseClient, withSupabaseRetry } from "../supabaseClient.js";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// Separate table from the general chat_messages (which is scoped by day
// and resets nightly) — School's thread is persistent and scoped by
// class_id instead, so each class keeps its own ongoing conversation.
export async function getSchoolChatHistory(classId: number, limit = 60): Promise<ChatMessage[]> {
  const client = getSupabaseClient();
  const { data, error } = await withSupabaseRetry(() =>
    client
      .from("school_chat_messages")
      .select("role, content")
      .eq("class_id", classId)
      .order("created_at", { ascending: true })
      .limit(limit)
  );

  if (error) {
    if (error.code === "PGRST205") return [];
    throw new Error(`Supabase read error: ${error.message}`);
  }
  return (data ?? []) as ChatMessage[];
}

export async function appendSchoolChatMessage(
  classId: number,
  role: "user" | "assistant",
  content: string
): Promise<void> {
  const client = getSupabaseClient();
  const { error } = await withSupabaseRetry(() =>
    client.from("school_chat_messages").insert({ class_id: classId, role, content })
  );
  if (error) {
    throw new Error(`Supabase insert error: ${error.message}`);
  }
}
