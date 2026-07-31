import type { DailyContext } from "./dailyContext.js";
import type { ChatMessage } from "./history.js";

const PERSONA_PROMPT = `You are Donna — the assistant embedded in Nathan's personal morning-brief Telegram bot (the same Donna this project's dashboard will eventually be named after: sharp, unflappable, always three steps ahead — not perky, not robotic). He can reply in this chat any time, not just right after the morning brief.

You have today's calendar, reminders, and curated news stories below — use them. You may also draw freely on your own general knowledge of markets, finance, and current events when a question goes beyond what's explicitly listed; you are not limited to only the provided text.

You cannot take real-world actions — no files, no code, no email, no browsing. Nothing gets executed or sent because of what you say here. If asked to do something outside answering questions, say plainly that you can't, then answer whatever part you can.

Keep replies short and text-message-appropriate — a few sentences, not an essay — unless asked for more detail.`;

function formatContextBlock(context: DailyContext | null): string {
  if (!context) {
    return "No brief has been generated yet today.";
  }

  const calendarText = context.calendarEvents.length
    ? context.calendarEvents
        .map((e) => {
          const time = new Date(e.start).toLocaleTimeString("en-US", {
            timeZone: context.timezone,
            hour: "numeric",
            minute: "2-digit",
          });
          const parts = [`${time} ${e.summary}`];
          if (e.location) parts.push(`Location: ${e.location}`);
          if (e.description) parts.push(e.description);
          return parts.join(" — ");
        })
        .join("\n")
    : "Nothing on the calendar today.";

  const remindersText = context.reminders.length
    ? context.reminders.map((r) => `- ${r}`).join("\n")
    : "No reminders.";

  const storiesText = context.stories.length
    ? context.stories
        .map(
          (s, i) =>
            `${i + 1}. [${s.category}] ${s.headline} (${s.source})\n${s.summary}\nECM angle: ${s.ecmTag}\nLink: ${s.url}`
        )
        .join("\n\n")
    : "No stories curated today.";

  return [
    `Today's calendar:\n${calendarText}`,
    `Today's reminders:\n${remindersText}`,
    `Today's curated news stories:\n${storiesText}`,
  ].join("\n\n---\n\n");
}

// Defensive normalization: the Anthropic Messages API requires strict
// user/assistant alternation. Stored history should already alternate, but
// this guards against any edge case (e.g. a row left over from before a
// failure-handling fix) producing two consecutive same-role turns.
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

export async function generateReply(
  context: DailyContext | null,
  history: ChatMessage[],
  userMessage: string
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("Missing ANTHROPIC_API_KEY in environment");
  }

  const system = `${PERSONA_PROMPT}\n\n${formatContextBlock(context)}`;
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
      max_tokens: 1024,
      system,
      messages,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${body}`);
  }

  const data = (await response.json()) as {
    content?: { type: string; text?: string }[];
  };
  const text = (data.content ?? [])
    .filter((block) => block.type === "text")
    .map((block) => block.text ?? "")
    .join("\n")
    .trim();

  return text || "Not sure how to answer that one.";
}
