const SYSTEM_PROMPT = `You are Donna, turning a raw lecture transcript into clean, organized study notes for a Princeton econ student. Structure with clear section headers and bullet points for key concepts; bold key terms. Keep the professor's actual content, examples, and any numbers/formulas mentioned — don't invent anything not covered in the transcript. Plain text with simple markdown-style formatting (headers as lines starting with "## ", bullets as "- "), no HTML.`;

export async function generateNotesFromTranscript(transcript: string): Promise<string> {
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
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Raw lecture transcript:\n\n${transcript}\n\nTurn this into organized study notes.`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${body}`);
  }

  const data = (await response.json()) as {
    content?: { type: string; text?: string }[];
  };
  return (data.content ?? [])
    .filter((block) => block.type === "text")
    .map((block) => block.text ?? "")
    .join("\n")
    .trim();
}
