export interface ProjectPrepFileCandidate {
  id: string;
  title: string;
  // Lecture transcripts / OCR'd text, when already extracted — Drive files
  // (never downloaded by this app) and still-processing uploads just have
  // a title to go on, which Claude can still reason about reasonably well.
  snippet?: string;
}

export interface ProjectPrepResult {
  selectedFileIds: { id: string; reason: string }[];
  instructions: string;
  starterPrompt: string;
}

const SYSTEM_PROMPT = `You help a college student assemble the pieces of a new Claude.ai Project for a specific assignment or study task. Given a task description and the list of files available for one of their classes, produce:

1. Which files (by id) are actually relevant to this specific task — not everything in the class, just what this task needs. Skip files that don't help. A short reason for each pick.
2. Tailored project custom-instructions text: written as if instructing an assistant helping with THIS specific task (not generic "help with this class") — mention the concrete topic/scope, how the student wants to work (e.g. work through problems together, explain concepts, quiz them), and reference the attached files' role without repeating their raw contents.
3. A starter prompt the student can paste as their first message to kick off the conversation productively.

YOUR OUTPUT MUST BE RAW JSON ONLY, no markdown fences, no preamble. Schema:
{"selectedFileIds":[{"id":"the exact id string given","reason":"one short sentence"}],"instructions":"the full instructions text","starterPrompt":"the full starter message"}`;

const MAX_SNIPPET_CHARS = 800;

export async function generateProjectPrep(
  taskDescription: string,
  className: string,
  candidates: ProjectPrepFileCandidate[]
): Promise<ProjectPrepResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("Missing ANTHROPIC_API_KEY in environment");
  }

  const fileList = candidates
    .map((c) => `- id: ${c.id}\n  title: ${c.title}${c.snippet ? `\n  excerpt: ${c.snippet.slice(0, MAX_SNIPPET_CHARS)}` : ""}`)
    .join("\n");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Class: ${className}\n\nTask: ${taskDescription}\n\nAvailable files:\n${fileList || "(none available)"}\n\nReturn the JSON object only.`,
        },
      ],
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
    .join("\n");

  return extractResult(text);
}

function extractResult(text: string): ProjectPrepResult {
  const cleaned = text
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/gi, "")
    .trim();

  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("Could not parse a project prep result from Claude's response");
  }

  function isFilePick(f: unknown): f is { id: string; reason: string } {
    return !!f && typeof f === "object" && typeof (f as Record<string, unknown>).id === "string" && typeof (f as Record<string, unknown>).reason === "string";
  }

  const parsed = JSON.parse(cleaned.slice(start, end + 1));
  const selectedFileIds = Array.isArray(parsed.selectedFileIds) ? parsed.selectedFileIds.filter(isFilePick) : [];

  if (typeof parsed.instructions !== "string" || typeof parsed.starterPrompt !== "string") {
    throw new Error("Project prep result missing instructions or starterPrompt");
  }

  return { selectedFileIds, instructions: parsed.instructions, starterPrompt: parsed.starterPrompt };
}
