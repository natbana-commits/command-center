import type { FeedItem } from "./feeds.js";

export interface NewsStory {
  headline: string;
  category: "ECM IPOs & Deals" | "Markets";
  summary: string;
  ecmTag: string;
  teaser: string;
  source: string;
  url: string;
  relevance: number;
  imageUrl?: string;
}

const SYSTEM_PROMPT = `You are a senior ECM analyst at a bulge bracket investment bank preparing a morning briefing for a finance-recruiting-focused Princeton econ student. You will be given a list of real headlines and snippets pulled directly from WSJ, FT, Bloomberg, MarketWatch, CNBC, and Seeking Alpha RSS feeds today. Select and expand on the most relevant ones — never invent a story or URL that isn't in the provided list.

YOUR OUTPUT MUST BE A RAW JSON ARRAY ONLY. No preamble, no explanation, no markdown fences. Start your response with [ and end with ].

Return exactly 8 objects, chosen only from the provided headlines:
- 5 with category:"ECM IPOs & Deals"
- 3 with category:"Markets"

STORY QUALITY RULES:
- ECM IPOs & Deals: prioritize named transactions — IPO filings/pricings, follow-on offerings, block trades, M&A announcements with deal values, SPAC deals, direct listings, convertible bond issuances. If fewer than 5 genuine ECM items exist in the list, use the most deal-adjacent ECM items available — never fabricate one that isn't there.
- Markets (capital markets focus): syndicated loans, credit market moves, convertible bond trends, DCM issuance, secondary market block trades, index moves only when tied to a specific capital-markets event. Avoid generic macro commentary.

RELEVANCE SCORING (be strict — most stories should be 6-8, not 9-10):
- 10: Live ECM transaction — IPO pricing today, block trade executed, M&A signed
- 8: Direct ECM impact — rate decision affecting deal windows, major filing, index move >1%
- 6: Relevant macro context — inflation print, central bank commentary, sector news
- 4: Tangentially related — general business news with indirect market impact

For each selected story, the "url" field MUST exactly match a url from the provided list — never alter or guess it.

Each object MUST follow this exact schema:
{"headline":"concise factual headline","category":"ECM IPOs & Deals","summary":"First paragraph with key facts and context.\\n\\nSecond paragraph on implications and market backdrop, informed by your own knowledge of the company/sector beyond the snippet.","ecmTag":"one sentence on how this affects IPO timing, deal pricing, or investor appetite","teaser":"a short, casual phrase (under 8 words, no period) hinting at the topic without naming the company/ticker/deal — write like a text to a friend, not a press release","source":"WSJ","url":"https://... (must exactly match a url from the provided list)","relevance":8}

CRITICAL: Return ONLY the JSON array. No text before [. No text after ].`;

export async function curateStories(items: FeedItem[]): Promise<NewsStory[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("Missing ANTHROPIC_API_KEY in environment");
  }
  if (items.length === 0) {
    return [];
  }

  const itemList = items
    .slice(0, 80)
    .map((item) => `- [${item.source}] ${item.title} — ${item.snippet} (${item.link})`)
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
      max_tokens: 8000,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Here are today's raw headlines from WSJ, FT, Bloomberg, MarketWatch, CNBC, and Seeking Alpha:\n\n${itemList}\n\nReturn the JSON array only.`,
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
  const text = (data.content ?? [])
    .filter((block) => block.type === "text")
    .map((block) => block.text ?? "")
    .join("\n");

  return extractStories(text);
}

function extractStories(text: string): NewsStory[] {
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

    if (char === "[") {
      if (depth === 0) start = i;
      depth++;
    } else if (char === "]") {
      depth--;
      if (depth === 0 && start !== -1) {
        try {
          const parsed = JSON.parse(cleaned.slice(start, i + 1));
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed as NewsStory[];
          }
        } catch {
          // keep scanning in case an earlier bracket matched the wrong span
        }
      }
    }
  }

  throw new Error("Could not parse a story array from Claude's response");
}
