export interface GeneratedFlashcard {
  question: string;
  answer: string;
}

const SYSTEM_PROMPT = `You are creating study flashcards from a lecture transcript for a college student preparing for exams. Read the transcript and produce flashcards covering the key concepts, definitions, and facts a student would actually need to know — not trivia, not filler, not things that were only mentioned in passing.

YOUR OUTPUT MUST BE A RAW JSON ARRAY ONLY. No preamble, no explanation, no markdown fences. Start your response with [ and end with ].

Return exactly this schema, one object per flashcard, 8-15 flashcards depending on how much substantive material the transcript actually covers:
[{"question":"a clear, specific question","answer":"a concise, complete answer (1-3 sentences)"}]

CRITICAL: Return ONLY the JSON array. No text before [. No text after ].`;

const MAX_TRANSCRIPT_CHARS = 20000;

export async function generateFlashcardsFromTranscript(
  transcript: string,
  className: string
): Promise<GeneratedFlashcard[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("Missing ANTHROPIC_API_KEY in environment");
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 3000,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Class: ${className}\n\nLecture transcript:\n\n${transcript.slice(0, MAX_TRANSCRIPT_CHARS)}\n\nReturn the JSON array only.`,
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

  return extractFlashcards(text);
}

function extractFlashcards(text: string): GeneratedFlashcard[] {
  const cleaned = text
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/gi, "")
    .trim();

  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("Could not parse a flashcard array from Claude's response");
  }

  const parsed = JSON.parse(cleaned.slice(start, end + 1));
  if (!Array.isArray(parsed)) {
    throw new Error("Parsed content is not an array");
  }

  return parsed.filter(
    (c): c is GeneratedFlashcard => c && typeof c.question === "string" && typeof c.answer === "string"
  );
}
