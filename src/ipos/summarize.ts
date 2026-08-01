export interface S1Summary {
  ticker: string | null;
  businessSummary: string;
  financialsSummary: string;
  dealTermsSummary: string;
  riskHighlights: string[];
}

const SYSTEM_PROMPT = `You are a research analyst summarizing excerpts from a company's SEC Form S-1 IPO registration statement for a finance student tracking new IPOs. You will be given excerpts from the filing (cover page, prospectus summary, risk factors, and — when present — use of proceeds, capitalization, and underwriting sections). These are excerpts, not the complete filing — if a section wasn't included in what you were given, say so plainly rather than guessing.

YOUR OUTPUT MUST BE A RAW JSON OBJECT ONLY. No preamble, no explanation, no markdown fences. Start your response with { and end with }.

Return exactly this schema:
{"ticker":"the stock ticker symbol if stated anywhere in the excerpts (e.g. a cover page or 'trades under the symbol X' mention), as a bare string like \\"ABCD\\", or null if none is stated","businessSummary":"2-3 plain-English sentences on what the company actually does","financialsSummary":"2-3 sentences on revenue, growth rate, and profitability/losses if stated in the excerpts, otherwise say the excerpts didn't include financial statements","dealTermsSummary":"1-2 sentences on exchange, ticker (if assigned), underwriters, and price range/proceeds if stated — note if only an estimated range is given rather than final terms","riskHighlights":["3-5 short bullet strings — the most notable/unusual risk factors mentioned, not generic boilerplate"]}

CRITICAL: Return ONLY the JSON object. No text before {. No text after }.`;

export async function summarizeS1(digest: string, companyName: string): Promise<S1Summary> {
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
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Company: ${companyName}\n\nFiling excerpts:\n\n${digest}\n\nReturn the JSON object only.`,
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

  return extractSummary(text);
}

function extractSummary(text: string): S1Summary {
  const cleaned = text
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/gi, "")
    .trim();

  let depth = 0;
  let start = -1;
  let inString = false;
  let escapeNext = false;

  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned[i];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    if (char === "\\") {
      escapeNext = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (char === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (char === "}") {
      depth--;
      if (depth === 0 && start !== -1) {
        try {
          const parsed = JSON.parse(cleaned.slice(start, i + 1));
          if (parsed && typeof parsed === "object") {
            return parsed as S1Summary;
          }
        } catch {
          // keep scanning in case an earlier brace matched the wrong span
        }
      }
    }
  }

  throw new Error("Could not parse a summary object from Claude's response");
}
