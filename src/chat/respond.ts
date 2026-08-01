import type { DailyContext } from "./dailyContext.js";
import type { ChatMessage } from "./history.js";
import { isGoogleConfigured } from "../google/auth.js";
import { getClassFolders } from "../drive/classFolders.js";
import { getClassFileContext } from "../drive/classContext.js";
import { listReminders, addReminder, completeReminder, type Reminder } from "../google/tasks.js";
import { searchEmails } from "../gmail/search.js";
import { searchContent } from "../search/index.js";
import { getEventsInRange } from "../calendar.js";
import { findOpenSlot } from "../scheduling/findSlot.js";
import { createCalendarEvent } from "../google/calendar.js";
import { scheduleNotification } from "../reminders/notifications.js";
import { withTimeSuffix, formatTimeLabel } from "../util/time.js";
import { searchCompanyFilings } from "../ipos/edgarFeed.js";
import { summarizeCompanyOnDemand } from "../ipos/checkNewIpos.js";
import { getIpoFilingByCompanyOrTicker, type IpoFiling } from "../ipos/store.js";
import { followCompany } from "../ipos/followedCompanies.js";

const PERSONA_PROMPT = `You are Donna — the assistant embedded in Nathan's personal morning-brief Telegram bot (the same Donna this project's dashboard will eventually be named after: sharp, unflappable, always three steps ahead — not perky, not robotic). He can reply in this chat any time, not just right after the morning brief.

You have today's calendar, reminders, and curated news stories below — use them. You may also draw freely on your own general knowledge of markets, finance, and current events when a question goes beyond what's explicitly listed; you are not limited to only the provided text.

You cannot take real-world actions — no browsing, no code execution, and you can never write or modify files. You do have a few read/write tools: get_class_files (pulls a class's Drive folder contents), search_email (searches Nathan's whole Gmail inbox, not just newsletters), search_content (searches stored newsletter bodies and lecture/photo upload transcripts by keyword — use this when he's trying to recall something from a specific past newsletter or lecture, as opposed to email generally or a specific class's Drive files), add_reminder / complete_reminder (real Google Tasks — use these whenever Nathan asks to add or check something off, don't just acknowledge it in text), find_and_schedule_time (finds a free calendar slot and books it directly — no confirmation step, same as reminders), schedule_reminder (schedules an actual timed text, not just a checklist entry), get_ipo_filing (pulls up the stored summary of an IPO S-1 filing Donna has already tracked, by company name or ticker), lookup_company_filings (checks EDGAR live for a company's S-1 that hasn't been tracked yet, and summarizes it on the spot if found — only covers S-1/IPO filings, not a general EDGAR search), and follow_company (starts tracking a company's future EDGAR filings — amendments, the eventual priced prospectus — flagging them in the daily check, not just its initial S-1). If asked to do something outside these, say plainly that you can't, then answer whatever part you can.

For schedule_reminder specifically: only call it once you know exactly when Nathan wants to be nudged. A deadline is not automatically a nudge time — "homework due Wednesday 11:59pm" tells you nothing about when he wants to be reminded about it. When that's ambiguous, ask him first (e.g. "want a nudge tomorrow morning, or at a specific time?") and call the tool once he answers, rather than guessing. Resolve whatever time he gives you (relative or absolute) into an exact ISO 8601 datetime using the current date/time given below.

If a tool failed earlier in this conversation (e.g. "not set up yet"), don't assume that's still true — the setup can change mid-conversation. Actually call the tool again rather than repeating the old failure from memory.

Keep replies short and text-message-appropriate — a few sentences, not an essay — unless asked for more detail.`;

function formatNow(timezone: string): string {
  const now = new Date();
  const dateLabel = now.toLocaleDateString("en-US", {
    timeZone: timezone,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const timeLabel = now.toLocaleTimeString("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
  });
  return `${dateLabel}, ${timeLabel} (${timezone})`;
}

function formatContextBlock(context: DailyContext | null, reminders: Reminder[], timezone: string): string {
  const calendarText = context?.calendarEvents.length
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
    : "Nothing on the calendar today (or no brief generated yet).";

  const remindersText = reminders.length
    ? reminders.map((r) => `- ${r.title}`).join("\n")
    : "No reminders.";

  const storiesText = context?.stories.length
    ? context.stories
        .map(
          (s, i) =>
            `${i + 1}. [${s.category}] ${s.headline} (${s.source})\n${s.summary}\nECM angle: ${s.ecmTag}\nLink: ${s.url}`
        )
        .join("\n\n")
    : "No stories curated today.";

  return [
    `Right now: ${formatNow(timezone)}`,
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
  {
    name: "add_reminder",
    description: "Create a new reminder in Nathan's Google Tasks. Use this whenever he asks to be reminded of something or to add something to his list.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Short reminder text" },
        notes: { type: "string", description: "Optional extra detail" },
      },
      required: ["title"],
    },
  },
  {
    name: "complete_reminder",
    description: "Mark an existing reminder as done, matching by title text (fuzzy/partial match is fine). Use whenever Nathan says he's done something or asks to check it off.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Text to match against existing reminder titles" },
      },
      required: ["title"],
    },
  },
  {
    name: "search_email",
    description:
      "Search Nathan's whole Gmail inbox (not just newsletters) using Gmail search syntax, returning subject/sender/date/snippet for matching emails. Use whenever he asks about an email or wants to find something in his inbox.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "Gmail search query, e.g. 'from:registrar subject:enrollment' or just keywords like 'ECO 301 syllabus'",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "search_content",
    description:
      "Search stored newsletter bodies and lecture/photo upload transcripts by keyword — not Drive class files (use get_class_files for those) and not general email (use search_email for that). Use when Nathan is trying to recall something from a specific past newsletter or a lecture/scan he uploaded.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Keywords to search for, e.g. 'convertible bond' or 'aggregate demand'" },
      },
      required: ["query"],
    },
  },
  {
    name: "find_and_schedule_time",
    description:
      "Find a free slot on Nathan's calendar within the next N days for an activity of a given duration, and book it directly as a calendar event — no separate confirmation step, same as add_reminder. Use whenever he wants to fit something into his schedule, e.g. 'I want to watch a film for 20 minutes in the next two days.'",
    input_schema: {
      type: "object",
      properties: {
        activity_title: {
          type: "string",
          description: "Short title for the calendar event, e.g. 'Watch film'",
        },
        duration_minutes: {
          type: "number",
          description: "How long the activity needs, in minutes",
        },
        within_days: {
          type: "number",
          description: "How many days from now to search for a free slot",
        },
      },
      required: ["activity_title", "duration_minutes", "within_days"],
    },
  },
  {
    name: "schedule_reminder",
    description:
      "Schedule a reminder that actually texts Nathan at a specific time (not just a silent checklist entry). Use whenever he gives a clear time for when he wants to be reminded. If he only gives a deadline without saying when he wants to be nudged about it, ask him first instead of guessing, then call this once he answers.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Short reminder text" },
        notify_at_iso: {
          type: "string",
          description:
            "The exact absolute date and time to send the reminder, as an ISO 8601 datetime with timezone offset, resolved from the current date/time given in the system prompt and whatever Nathan said",
        },
      },
      required: ["title", "notify_at_iso"],
    },
  },
  {
    name: "get_ipo_filing",
    description:
      "Look up an already-tracked IPO S-1 filing by company name or ticker, returning its business summary, financials, deal terms, and risk highlights. Use for follow-up questions about an IPO Donna has already summarized (in the daily check or an earlier lookup_company_filings call).",
    input_schema: {
      type: "object",
      properties: {
        company_or_ticker: { type: "string", description: "Company name or ticker to look up, e.g. 'Figma' or 'FIG'" },
      },
      required: ["company_or_ticker"],
    },
  },
  {
    name: "lookup_company_filings",
    description:
      "Check SEC EDGAR live for a company's initial S-1 IPO registration that hasn't been tracked yet (e.g. asked about before the daily check ran, or an older filing outside the daily window), and summarize it on the spot if one is found. Only covers S-1/IPO filings — not a general EDGAR search tool.",
    input_schema: {
      type: "object",
      properties: {
        company_name: { type: "string", description: "Company name to search EDGAR for, e.g. 'Figma'" },
      },
      required: ["company_name"],
    },
  },
  {
    name: "follow_company",
    description:
      "Start tracking a company's future SEC EDGAR filings (any form type — an S-1/A amendment, the eventual 424B4 priced prospectus) so they get flagged in the daily check, not just its initial S-1. Use when Nathan asks to follow, track, or keep an eye on a specific IPO company.",
    input_schema: {
      type: "object",
      properties: {
        company_name: { type: "string", description: "Company name to follow, e.g. 'Figma'" },
      },
      required: ["company_name"],
    },
  },
];

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

  return getClassFileContext(match);
}

async function executeAddReminder(title: string, notes?: string): Promise<string> {
  if (!isGoogleConfigured()) {
    return "Google Tasks isn't connected yet — Nathan needs to finish the Google OAuth setup first.";
  }
  if (!title) {
    return "Need a title to add a reminder.";
  }
  await addReminder(title, notes);
  return `Added: "${title}"`;
}

async function executeCompleteReminder(titleMatch: string): Promise<string> {
  if (!isGoogleConfigured()) {
    return "Google Tasks isn't connected yet — Nathan needs to finish the Google OAuth setup first.";
  }
  const reminders = await listReminders();
  const match = reminders.find((r) => r.title.toLowerCase().includes(titleMatch.toLowerCase()));
  if (!match) {
    return `Couldn't find a reminder matching "${titleMatch}".`;
  }
  await completeReminder(match.id);
  return `Marked done: "${match.title}"`;
}

async function executeSearchEmail(query: string): Promise<string> {
  if (!isGoogleConfigured()) {
    return "Gmail isn't connected yet — Nathan needs to finish the Google OAuth setup first.";
  }
  if (!query) {
    return "Need a search query to look through email.";
  }
  const results = await searchEmails(query);
  if (results.length === 0) {
    return `No emails found matching "${query}".`;
  }
  return results
    .map((r, i) => `${i + 1}. [${r.date}] ${r.subject} (from ${r.sender})\n${r.snippet}`)
    .join("\n\n");
}

async function executeSearchContent(query: string): Promise<string> {
  if (!query) {
    return "Need a search query.";
  }
  const results = await searchContent(query);
  if (results.length === 0) {
    return `No newsletters or uploads found matching "${query}".`;
  }
  return results
    .map((r, i) => `${i + 1}. [${r.kind}, ${r.date}] ${r.title}\n${r.snippet}`)
    .join("\n\n");
}

async function executeFindAndScheduleTime(
  activityTitle: string,
  durationMinutes: number,
  withinDays: number,
  timezone: string
): Promise<string> {
  if (!isGoogleConfigured()) {
    return "Calendar isn't connected yet — Nathan needs to finish the Google OAuth setup first.";
  }
  if (!activityTitle || !durationMinutes || !withinDays) {
    return "Need an activity title, a duration in minutes, and how many days to search within.";
  }

  const now = new Date();
  const rangeEnd = new Date(now.getTime() + withinDays * 24 * 60 * 60 * 1000);

  let events;
  try {
    const result = await getEventsInRange(timezone, now, rangeEnd);
    events = result.events;
  } catch (err) {
    return `Couldn't read the calendar to find a slot: ${err instanceof Error ? err.message : String(err)}`;
  }

  const slot = findOpenSlot(events, durationMinutes, now, rangeEnd, timezone);
  if (!slot) {
    return `No open ${durationMinutes}-minute slot found in the next ${withinDays} day(s) between 8am and 10pm. Want me to widen the window?`;
  }

  try {
    await createCalendarEvent({
      summary: activityTitle,
      startIso: slot.start.toISOString(),
      endIso: slot.end.toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return `Found a free slot but couldn't book it — calendar write access probably isn't set up yet (needs the calendar.events scope re-authorized, see docs/google-setup.md). Error: ${message}`;
  }

  const startLabel = slot.start.toLocaleString("en-US", {
    timeZone: timezone,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  const endLabel = slot.end.toLocaleString("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
  });
  return `Booked "${activityTitle}" for ${startLabel}–${endLabel}.`;
}

async function executeScheduleReminder(title: string, notifyAtIso: string, timezone: string): Promise<string> {
  if (!isGoogleConfigured()) {
    return "Google Tasks isn't connected yet — Nathan needs to finish the Google OAuth setup first.";
  }
  if (!title || !notifyAtIso) {
    return "Need both a title and a specific time to schedule a reminder.";
  }
  const parsed = new Date(notifyAtIso);
  if (Number.isNaN(parsed.getTime())) {
    return `Couldn't parse "${notifyAtIso}" as a valid date/time.`;
  }

  // Google Tasks' due field never shows a time in Google Tasks or
  // Calendar no matter what's sent — baking the real time into the title
  // is the only way it's visible there.
  const googleTitle = withTimeSuffix(title, formatTimeLabel(notifyAtIso, timezone));
  const task = await addReminder(googleTitle, undefined, notifyAtIso);

  try {
    await scheduleNotification(task.id, parsed.toISOString(), title);
  } catch (err) {
    // The Task itself was already created — leaving it would be a silent
    // reminder that looks scheduled but can never actually fire, since
    // nothing tracks its notify time without this row. Undo it rather
    // than leave that half-done state behind.
    await completeReminder(task.id).catch(() => {});
    const message = err instanceof Error ? err.message : String(err);
    return `Couldn't schedule the timed text (the reminder-delivery setup likely isn't finished yet) — nothing was added. Error: ${message}`;
  }

  return `Scheduled: "${title}" — I'll text you then.`;
}

function formatFilingForChat(filing: IpoFiling): string {
  return [
    `${filing.companyName}${filing.ticker ? ` (${filing.ticker})` : ""} — filed ${filing.filedDate}`,
    `Business: ${filing.businessSummary ?? "not summarized"}`,
    `Financials: ${filing.financialsSummary ?? "not summarized"}`,
    `Deal terms: ${filing.dealTermsSummary ?? "not summarized"}`,
    filing.riskHighlights.length
      ? `Risk highlights:\n${filing.riskHighlights.map((r) => `- ${r}`).join("\n")}`
      : "",
    `Source: ${filing.sourceUrl}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

async function executeGetIpoFiling(companyOrTicker: string): Promise<string> {
  if (!companyOrTicker) {
    return "Need a company name or ticker to look up.";
  }
  const filing = await getIpoFilingByCompanyOrTicker(companyOrTicker);
  if (!filing) {
    return `No tracked IPO filing found matching "${companyOrTicker}" — try lookup_company_filings in case the daily check hasn't caught it yet.`;
  }
  return formatFilingForChat(filing);
}

async function executeLookupCompanyFilings(companyName: string): Promise<string> {
  if (!companyName) {
    return "Need a company name to search EDGAR for.";
  }

  const alreadyTracked = await getIpoFilingByCompanyOrTicker(companyName);
  if (alreadyTracked) {
    return formatFilingForChat(alreadyTracked);
  }

  let entries;
  try {
    entries = await searchCompanyFilings(companyName);
  } catch (err) {
    return `Couldn't search EDGAR: ${err instanceof Error ? err.message : String(err)}`;
  }
  const initial = entries.find((e) => e.formType === "S-1");
  if (!initial) {
    return `No S-1 filing found on EDGAR for "${companyName}".`;
  }

  try {
    const filing = await summarizeCompanyOnDemand(
      initial.cik,
      initial.accessionNo,
      initial.companyName,
      initial.filedDate
    );
    return formatFilingForChat(filing);
  } catch (err) {
    return `Found the filing but couldn't summarize it: ${err instanceof Error ? err.message : String(err)}`;
  }
}

async function executeFollowCompany(companyName: string): Promise<string> {
  if (!companyName) {
    return "Need a company name to follow.";
  }

  let entries;
  try {
    entries = await searchCompanyFilings(companyName);
  } catch (err) {
    return `Couldn't search EDGAR: ${err instanceof Error ? err.message : String(err)}`;
  }
  const match = entries[0];
  if (!match) {
    return `No S-1 filing found on EDGAR for "${companyName}" — can't resolve it to follow yet.`;
  }

  await followCompany(match.cik, match.companyName);
  return `Now following ${match.companyName} — I'll flag any new filing for it in the morning check.`;
}

async function executeToolCall(name: string, input: unknown, timezone: string): Promise<string> {
  if (name === "get_class_files") {
    const className = (input as { class_name?: string } | undefined)?.class_name ?? "";
    return executeGetClassFiles(className);
  }
  if (name === "add_reminder") {
    const parsed = input as { title?: string; notes?: string } | undefined;
    return executeAddReminder(parsed?.title ?? "", parsed?.notes);
  }
  if (name === "complete_reminder") {
    const parsed = input as { title?: string } | undefined;
    return executeCompleteReminder(parsed?.title ?? "");
  }
  if (name === "search_email") {
    const parsed = input as { query?: string } | undefined;
    return executeSearchEmail(parsed?.query ?? "");
  }
  if (name === "search_content") {
    const parsed = input as { query?: string } | undefined;
    return executeSearchContent(parsed?.query ?? "");
  }
  if (name === "find_and_schedule_time") {
    const parsed = input as
      | { activity_title?: string; duration_minutes?: number; within_days?: number }
      | undefined;
    return executeFindAndScheduleTime(
      parsed?.activity_title ?? "",
      parsed?.duration_minutes ?? 0,
      parsed?.within_days ?? 0,
      timezone
    );
  }
  if (name === "schedule_reminder") {
    const parsed = input as { title?: string; notify_at_iso?: string } | undefined;
    return executeScheduleReminder(parsed?.title ?? "", parsed?.notify_at_iso ?? "", timezone);
  }
  if (name === "get_ipo_filing") {
    const parsed = input as { company_or_ticker?: string } | undefined;
    return executeGetIpoFiling(parsed?.company_or_ticker ?? "");
  }
  if (name === "lookup_company_filings") {
    const parsed = input as { company_name?: string } | undefined;
    return executeLookupCompanyFilings(parsed?.company_name ?? "");
  }
  if (name === "follow_company") {
    const parsed = input as { company_name?: string } | undefined;
    return executeFollowCompany(parsed?.company_name ?? "");
  }
  return `Unknown tool: ${name}`;
}

export async function generateReply(
  context: DailyContext | null,
  history: ChatMessage[],
  userMessage: string,
  timezone: string
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("Missing ANTHROPIC_API_KEY in environment");
  }

  const reminders = isGoogleConfigured() ? await listReminders().catch(() => []) : [];
  const system = `${PERSONA_PROMPT}\n\n${formatContextBlock(context, reminders, timezone)}`;
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
        content: await executeToolCall(block.name!, block.input, timezone),
      }))
    );
    messages.push({ role: "user", content: toolResults });
  }

  return "Ran into trouble pulling that together — try again?";
}
