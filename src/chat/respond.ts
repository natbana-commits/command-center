import type { DailyContext } from "./dailyContext.js";
import type { ChatMessage } from "./history.js";
import { isGoogleConfigured } from "../google/auth.js";
import { getClassFolders } from "../drive/classFolders.js";
import { listFilesInFolder } from "../drive/list.js";
import { getFileContent } from "../drive/content.js";

const PERSONA_PROMPT = `You are Donna — the assistant embedded in Nathan's personal morning-brief Telegram bot (the same Donna this project's dashboard will eventually be named after: sharp, unflappable, always three steps ahead — not perky, not robotic). He can reply in this chat any time, not just right after the morning brief.

You have today's calendar, reminders, and curated news stories below — use them. You may also draw freely on your own general knowledge of markets, finance, and current events when a question goes beyond what's explicitly listed; you are not limited to only the provided text.

You cannot take real-world actions — no email, no browsing, no code execution, and you can never write or modify anything. Nothing gets executed or sent because of what you say here. The one exception is a read-only tool, get_class_files: it pulls the contents of a specific class's Drive folder (once Nathan has set one up in Settings). Use it whenever he wants help studying, doing homework, or writing something for a specific class, then work directly with that material. If asked to do something outside answering questions or reading class files, say plainly that you can't, then answer whatever part you can.

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

interface ApiContentBlock {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: unknown;
  tool_use_id?: string;
  content?: string;
}

interface ApiMessage {
  role: "user" | "assistant";
  content: string | ApiContentBlock[];
}

const TOOLS = [
  {
    name: "get_class_files",
    description:
      "Fetch the file list and extracted text content of a specific class's Drive folder, to use as working context for studying, homework, or writing for that class. Call this whenever Nathan asks for help with a specific class or its materials.",
    input_schema: {
      type: "object",
      properties: {
        class_name: {
          type: "string",
          description: "The class name as configured in settings, e.g. 'ECO 301'",
        },
      },
      required: ["class_name"],
    },
  },
];

const MAX_FILES_PER_CLASS = 10;
const MAX_CHARS_PER_FILE = 6000;

async function executeGetClassFiles(className: string): Promise<string> {
  if (!isGoogleConfigured()) {
    return "Drive isn't connected yet — Nathan needs to finish the Google OAuth setup first.";
  }

  const classFolders = await getClassFolders();
  const match = classFolders.find((c) => c.className.toLowerCase() === className.toLowerCase());

  if (!match) {
    const available = classFolders.map((c) => c.className).join(", ");
    return available
      ? `No class folder configured for "${className}". Available classes: ${available}.`
      : `No class folder configured for "${className}", and no classes have been set up yet.`;
  }

  const files = await listFilesInFolder(match.driveFolderId);
  if (files.length === 0) {
    return `The ${match.className} folder exists but has no files in it yet.`;
  }

  const contents = await Promise.all(
    files.slice(0, MAX_FILES_PER_CLASS).map(async (f) => {
      const text = await getFileContent(f);
      return text
        ? `--- ${f.name} ---\n${text.slice(0, MAX_CHARS_PER_FILE)}`
        : `--- ${f.name} ---\n(unsupported file type, no text extracted)`;
    })
  );

  return contents.join("\n\n");
}

async function executeToolCall(name: string, input: unknown): Promise<string> {
  if (name === "get_class_files") {
    const className = (input as { class_name?: string } | undefined)?.class_name ?? "";
    return executeGetClassFiles(className);
  }
  return `Unknown tool: ${name}`;
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
  const messages: ApiMessage[] = coalesce([...history, { role: "user", content: userMessage }]);

  const MAX_TOOL_ITERATIONS = 3;
  for (let iteration = 0; iteration <= MAX_TOOL_ITERATIONS; iteration++) {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 2048,
        system,
        messages,
        tools: TOOLS,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Anthropic API error ${response.status}: ${body}`);
    }

    const data = (await response.json()) as { content?: ApiContentBlock[] };
    const contentBlocks = data.content ?? [];
    const toolUseBlocks = contentBlocks.filter((b) => b.type === "tool_use");

    if (toolUseBlocks.length === 0 || iteration === MAX_TOOL_ITERATIONS) {
      const text = contentBlocks
        .filter((b) => b.type === "text")
        .map((b) => b.text ?? "")
        .join("\n")
        .trim();
      return text || "Not sure how to answer that one.";
    }

    messages.push({ role: "assistant", content: contentBlocks });

    const toolResults: ApiContentBlock[] = await Promise.all(
      toolUseBlocks.map(async (block) => ({
        type: "tool_result",
        tool_use_id: block.id!,
        content: await executeToolCall(block.name!, block.input),
      }))
    );
    messages.push({ role: "user", content: toolResults });
  }

  return "Ran into trouble pulling that together — try again?";
}
