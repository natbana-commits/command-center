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
      "Backed by Google Tasks, so anything you add also shows up in your real Tasks app. Give a reminder a specific time and Donna will actually text you then, not just show a due date. You can also link a reminder to a class — linked ones show grouped by class here and as an \"Upcoming Deadlines\" glance on the Files page.",
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
    title: "Chat assistant",
    description:
      "Donna's the same assistant in Telegram and in the chat bubble on every page here. She can add or complete reminders, search your whole Gmail inbox, search stored newsletters and lecture transcripts by keyword, find and book calendar time, and pull up a specific class's files — all through plain conversation, no special syntax needed.",
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
