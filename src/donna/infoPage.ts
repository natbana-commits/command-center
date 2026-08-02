import type { NavVisibility } from "../config.js";
import { renderLayout } from "./layout.js";

interface InfoSection {
  title: string;
  description: string;
}

const SECTIONS: InfoSection[] = [
  {
    title: "Home & News",
    description:
      "Once each weekday morning, Donna pulls markets/ECM headlines from WSJ, FT, Bloomberg, MarketWatch, CNBC, and Seeking Alpha and picks the 8 most relevant. If a company or ticker on your Watchlist (Settings) shows up, it's guaranteed a spot and gets a ★ Watchlist badge here on Home.",
  },
  {
    title: "Newsletters",
    description:
      "Today's newsletters show up right on Home, collapsed by default — click one to read the full email inline. Only today's are kept here; anything older gets pruned automatically.",
  },
  {
    title: "Calendar",
    description:
      "A 14-day agenda view of your Google Calendar. It's read-only from this page, but you can ask Donna in chat to find a free slot and book something directly — e.g. \"find 30 minutes for a workout tomorrow.\"",
  },
  {
    title: "Reminders",
    description:
      "Backed by Google Tasks, so anything you add also shows up in your real Tasks app — including from the Tasks tab built into the Google Calendar app itself, as long as you file it under the \"Donna Reminders\" list there. Give a reminder a specific time and Donna will actually text you then, not just show a due date. Color-coded groups (School, Life, Personal, etc. — manage them from Settings) organize reminders independently of class links: sort by due date or switch to grouped view, and the \"+\" button opens a quick add form. You can also link a reminder to a class — linked ones power the \"Upcoming Deadlines\" glance on the Files page.",
  },
  {
    title: "Files",
    description:
      "Each class you set up in Settings gets its own Google Drive folder shown here. Upload a lecture recording and Donna transcribes it (and writes a quick set of notes) automatically; upload a photo or scanned document and it extracts the text. Ask Donna in chat to pull up a class's files as context for homework help.",
  },
  {
    title: "Contacts",
    description:
      "A recruiting/networking tracker — name, firm, bio, a relationship tag (Recruiter, Alum, Mentor, etc.), and a running log of interactions (call, email, coffee chat…) each with its own date and notes. \"Time since last contact\" updates automatically from whichever was most recent. Each contact also has a one-click \"+ Reminder\" button for a follow-up.",
  },
  {
    title: "IPOs",
    description:
      "Once a day Donna checks SEC EDGAR for newly-filed S-1 IPO registrations, reads the filing, and summarizes the business, key financials, deal terms, and notable risk factors — shown here and as a Home glance, with a callout in the morning text when something new filed. It's a best-effort digest of a large document, not a substitute for reading the real filing. \"Follow\" a specific company (from this page or by asking Donna in chat) to also get flagged on its later filings — amendments, or the final priced prospectus, which usually lands well after the initial S-1.",
  },
  {
    title: "Finances",
    description:
      "Link any Plaid-compatible bank, card, or brokerage (Amex, Marcus, PNC, and thousands of others — Fidelity isn't currently supported by Plaid) via the \"+ Link an account\" button. Donna only ever reads balances and recent transactions — she can't move money, initiate a transfer, or place a trade. Access tokens are encrypted before storage, and updates arrive in real time via Plaid's webhooks rather than needing a manual refresh. Unlink an account any time from this page to remove it and its data.",
  },
  {
    title: "School",
    description:
      "Pick a class to see its flashcards and lecture uploads. \"Chat about [class]\" opens a dedicated conversation on the Chat tab that auto-loads that class's Drive files as context and keeps its own separate, persistent history. Generate flashcards from any transcribed lecture upload with one click, then review them on a simple spaced-repetition schedule (cards you get right come back less often; ones you miss come back sooner).",
  },
  {
    title: "Chat",
    description:
      "Donna's the same assistant everywhere — Telegram, the floating chat bubble on every page, and the dedicated Chat tab, which adds a mode switcher across the top: General (full tool access — reminders, email search, calendar, IPO lookups) or any class you've set up (auto-loaded Drive context, its own separate history, a one-click \"Generate practice problems\"). The floating bubble is always General mode and shares that same conversation with the Chat tab's General mode, so switching between them mid-conversation is seamless.",
  },
  {
    title: "Markets & Economic Calendar",
    description:
      "The Markets card (off by default — turn it on in Settings) shows a live price and day change for each ticker on your Watchlist, via Finnhub's free tier — set FINNHUB_API_KEY to use it. The Upcoming Econ Events card needs no setup: it's a small manually-seeded calendar of FOMC meetings and CPI/jobs/GDP release dates, sourced from the Fed/BLS/BEA's own published schedules rather than a live feed (those dates are published many months ahead, so there's nothing to poll). It only covers what was seeded on 2026-08-01 — refresh it once a year with the next year's official schedule.",
  },
  {
    title: "Dashboard & Morning text",
    description:
      "Settings is where everything gets tuned: show, hide, or reorder the Home cards; pick which tab (News or Newsletters) opens by default; hide any sidebar page you don't use; choose exactly which sections (news, calendar, reminders) get texted each morning and how many headlines; and manage your company/ticker Watchlist.",
  },
];

function renderSection(section: InfoSection): string {
  return `
    <div class="card" style="margin-bottom: var(--sp-3);">
      <h1 class="section-title">${section.title}</h1>
      <p>${section.description}</p>
    </div>`;
}

export function buildInfoHtml(navVisibility: NavVisibility, navOrder: string[]): string {
  const body = `
    <div class="section">
      <h1 class="page-title">Info</h1>
      <p class="page-sub">What Donna can do</p>
    </div>
    ${SECTIONS.map(renderSection).join("\n")}`;

  return renderLayout({
    title: "Donna Info",
    activeTab: "info",
    bodyHtml: body,
    showChatFab: true,
    navVisibility,
    navOrder,
  });
}
