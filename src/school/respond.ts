import type { ChatMessage } from "./chatHistory.js";

const SYSTEM_PROMPT_TEMPLATE = (className: string, fileContext: string) => `You are Donna, helping Nathan study for ${className}. Below is the current content of his ${className} Drive folder (lecture notes, slides, readings) — use it as your primary source when he asks about course material, and say plainly when something isn't covered in what's given rather than guessing or inventing details.

${fileContext}

Keep answers focused and study-oriented: explain concepts clearly, work through problems step by step when asked, and quiz him if he asks to be quizzed. If he asks for practice problems, generate a handful with a full answer key at the end (not just answers with no explanation).`;

// Defensive normalization: the Anthropic Messages API requires strict
// user/assistant alternation. Same reasoning as chat/respond.ts's own
// coalesce — duplicated here rather than imported since each chat
// surface (general vs. per-class) stays self-contained, matching this
// project's existing convention of no shared API client wrapper.
function coalesce(messages: ChatMessage[]): ChatMessage[] {
  const result: ChatMessage[] = [];
  for (const message of messages) {
    const last = result[result.length - 1];
    if (last && last.role === message.role) {
      last.content = `${last.content}\n\n${message.content}`;
    } else {
      result.push({ ...message });
    }
  }
  return result;
}

export async function generateSchoolReply(
  className: string,
  fileContext: string,
  history: ChatMessage[],
  userMessage: string
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("Missing ANTHROPIC_API_KEY in environment");
  }

  const messages = coalesce([...history, { role: "user", content: userMessage }]);

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 1500,
      system: SYSTEM_PROMPT_TEMPLATE(className, fileContext),
      messages,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${body}`);
  }

  const data = (await response.json()) as { content?: { type: string; text?: string }[] };
  const text = (data.content ?? [])
    .filter((block) => block.type === "text")
    .map((block) => block.text ?? "")
    .join("\n")
    .trim();

  return text || "Not sure how to help with that.";
}
