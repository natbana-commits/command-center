import type { HomeWidgetId, FinanceWidgetId, NavVisibility, Settings } from "../config.js";
import type { ClassFolder } from "../drive/classFolders.js";
import type { WatchlistEntry } from "../news/watchlist.js";
import type { ReminderGroup } from "../reminders/groups.js";
import type { CommunityFeedSource } from "../news/communityFeeds.js";
import type { SessionInfo } from "../auth/session.js";
import type { ManualBill } from "../finance/manualBills.js";
import { escapeHtml } from "../util/html.js";
import { renderLayout } from "./layout.js";
import { NAV_TAB_LABELS } from "./nav.js";

// Folded in from the old dedicated Info tab (retired to free a sidebar
// slot — Settings already gets a small icon of its own in the sidebar
// footer, see layout.ts, so this reference material lives one collapsed
// click away here instead of its own full nav entry).
interface HowThisWorksSection {
  title: string;
  description: string;
}

const HOW_THIS_WORKS: HowThisWorksSection[] = [
  {
    title: "Home & News",
    description:
      "Once each weekday morning, Donna pulls markets/ECM headlines from WSJ, FT, Bloomberg, MarketWatch, CNBC, and Seeking Alpha and picks the 8 most relevant. If a company or ticker on your Watchlist (below) shows up, it's guaranteed a spot and gets a ★ Watchlist badge here on Home.",
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
      "Backed by Google Tasks, so anything you add also shows up in your real Tasks app — including from the Tasks tab built into the Google Calendar app itself, as long as you file it under the \"Donna Reminders\" list there. Give a reminder a specific time and Donna will actually text you then, not just show a due date. Color-coded groups (School, Life, Personal, etc. — manage them below) organize reminders independently of class links: sort by due date or switch to grouped view, and the \"+\" button opens a quick add form. You can also link a reminder to a class — linked ones power the \"Upcoming Deadlines\" glance on the Files page.",
  },
  {
    title: "Files",
    description:
      "Each class you set up below gets its own Google Drive folder shown here. Upload a lecture recording and Donna transcribes it (and writes a quick set of notes) automatically; upload a photo or scanned document and it extracts the text. Ask Donna in chat to pull up a class's files as context for homework help.",
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
      "The Markets card (off by default — turn it on above) shows a live price and day change for each ticker on your Watchlist, via Finnhub's free tier — set FINNHUB_API_KEY to use it. The Upcoming Econ Events card needs no setup: it's a small manually-seeded calendar of FOMC meetings and CPI/jobs/GDP release dates, sourced from the Fed/BLS/BEA's own published schedules rather than a live feed (those dates are published many months ahead, so there's nothing to poll). It only covers what was seeded on 2026-08-01 — refresh it once a year with the next year's official schedule.",
  },
];

function renderHowThisWorksSection(section: HowThisWorksSection): string {
  return `
    <div class="card" style="margin-bottom: var(--sp-3);">
      <h1 class="section-title">${escapeHtml(section.title)}</h1>
      <p>${escapeHtml(section.description)}</p>
    </div>`;
}

const WIDGET_LABELS: Record<HomeWidgetId, string> = {
  "recent-activity": "Recent Activity",
  upcoming: "Upcoming",
  reminders: "Reminders",
  contacts: "Contacts",
  files: "Files",
  ipos: "IPOs",
  finances: "Finances",
  markets: "Markets",
  "econ-events": "Upcoming Econ Events",
};

const FINANCE_WIDGET_LABELS: Record<FinanceWidgetId, string> = {
  "net-worth": "Net Worth",
  "spending-over-time": "Spending Over Time",
  "spending-by-category": "Spending by Category",
  accounts: "Accounts",
  "recurring-charges": "Recurring Charges",
  "upcoming-payments": "Upcoming Payments",
  transactions: "Recent Transactions",
};

function renderClassRows(classFolders: ClassFolder[]): string {
  if (classFolders.length === 0) {
    return `<p class="empty">No classes added yet.</p>`;
  }

  return classFolders
    .map(
      (cls) => `
        <div class="class-row">
          <span>${escapeHtml(cls.className)}</span>
          <form method="POST" action="/api/donna-settings">
            <input type="hidden" name="action" value="delete-class" />
            <input type="hidden" name="id" value="${cls.id}" />
            <button class="btn btn-danger" type="submit">Remove</button>
          </form>
        </div>`
    )
    .join("\n");
}

function renderManualBillRows(bills: ManualBill[]): string {
  if (bills.length === 0) {
    return `<p class="empty">No manual bills yet.</p>`;
  }

  return bills
    .map(
      (b) => `
        <div class="class-row">
          <span>${escapeHtml(b.name)} — $${escapeHtml(b.amount.toFixed(2))}, due the ${escapeHtml(String(b.dueDay))}${escapeHtml(ordinalSuffix(b.dueDay))}</span>
          <form method="POST" action="/api/donna-settings">
            <input type="hidden" name="action" value="delete-manual-bill" />
            <input type="hidden" name="id" value="${b.id}" />
            <button class="btn btn-danger" type="submit">Remove</button>
          </form>
        </div>`
    )
    .join("\n");
}

function ordinalSuffix(day: number): string {
  if (day % 10 === 1 && day !== 11) return "st";
  if (day % 10 === 2 && day !== 12) return "nd";
  if (day % 10 === 3 && day !== 13) return "rd";
  return "th";
}

function renderReminderGroupRows(groups: ReminderGroup[]): string {
  if (groups.length === 0) {
    return `<p class="empty">No reminder groups yet.</p>`;
  }

  return groups
    .map(
      (g) => `
        <div class="class-row">
          <span><span class="group-swatch" style="background:${escapeHtml(g.color)};"></span>${escapeHtml(g.name)}</span>
          <form method="POST" action="/api/donna-settings">
            <input type="hidden" name="action" value="delete-reminder-group" />
            <input type="hidden" name="id" value="${g.id}" />
            <button class="btn btn-danger" type="submit">Remove</button>
          </form>
        </div>`
    )
    .join("\n");
}

function renderWatchlistRows(entries: WatchlistEntry[]): string {
  if (entries.length === 0) {
    return `<p class="empty">No watchlist entries yet.</p>`;
  }

  return entries
    .map(
      (e) => `
        <div class="class-row">
          <span>${escapeHtml(e.label)}</span>
          <form method="POST" action="/api/donna-settings">
            <input type="hidden" name="action" value="delete-watchlist-entry" />
            <input type="hidden" name="id" value="${e.id}" />
            <button class="btn btn-danger" type="submit">Remove</button>
          </form>
        </div>`
    )
    .join("\n");
}

function renderCommunityFeedRows(sources: CommunityFeedSource[]): string {
  if (sources.length === 0) {
    return `<p class="empty">No community sources yet.</p>`;
  }

  return sources
    .map(
      (s) => `
        <div class="class-row">
          <span>${escapeHtml(s.label)}</span>
          <form method="POST" action="/api/donna-settings">
            <input type="hidden" name="action" value="delete-community-feed-source" />
            <input type="hidden" name="id" value="${s.id}" />
            <button class="btn btn-danger" type="submit">Remove</button>
          </form>
        </div>`
    )
    .join("\n");
}

// Rough, best-effort device label from the raw User-Agent header — just
// enough to tell sessions apart at a glance ("iPhone" vs "Mac"), not a
// full UA parse.
function describeUserAgent(ua: string | null): string {
  if (!ua) return "Unknown device";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Chrome\//.test(ua)
      ? "Chrome"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Safari\//.test(ua)
          ? "Safari"
          : "Browser";
  const device = /iPhone/.test(ua)
    ? "iPhone"
    : /iPad/.test(ua)
      ? "iPad"
      : /Android/.test(ua)
        ? "Android"
        : /Macintosh/.test(ua)
          ? "Mac"
          : /Windows/.test(ua)
            ? "Windows"
            : "device";
  return `${browser} on ${device}`;
}

function formatSessionTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function renderSessionRow(session: SessionInfo, currentSessionId: string | null): string {
  const isCurrent = session.id === currentSessionId;
  return `
    <div class="class-row">
      <span>
        ${escapeHtml(describeUserAgent(session.userAgent))}${isCurrent ? ` <span class="hint" style="margin:0;">(this device)</span>` : ""}
        <span class="hint" style="display:block;">Last active ${escapeHtml(formatSessionTime(session.lastSeenAt))}</span>
      </span>
      ${
        isCurrent
          ? ""
          : `<form method="POST" action="/api/donna-settings">
        <input type="hidden" name="action" value="revoke-session" />
        <input type="hidden" name="id" value="${escapeHtml(session.id)}" />
        <button class="btn btn-danger" type="submit">Sign out</button>
      </form>`
      }
    </div>`;
}

function renderSessionRows(sessions: SessionInfo[], currentSessionId: string | null): string {
  if (sessions.length === 0) {
    return `<p class="empty">No active sessions.</p>`;
  }
  return sessions.map((s) => renderSessionRow(s, currentSessionId)).join("\n");
}

// Same reorderable-row pattern as renderWidgetRow, on distinct action
// names (move-nav-up/down vs move-up/down) so the single dashboard form
// can tell a nav-reorder click apart from a widget-reorder click.
function renderNavRow(tab: string, visible: boolean, index: number, total: number): string {
  return `
    <div class="widget-row">
      <label class="widget-row-label">
        <input type="checkbox" name="nav-${tab}" ${visible ? "checked" : ""} />
        ${escapeHtml(NAV_TAB_LABELS[tab as keyof typeof NAV_TAB_LABELS] ?? tab)}
      </label>
      <div class="widget-row-controls">
        ${index > 0 ? `<button class="btn-secondary btn-small" type="submit" name="action" value="move-nav-up:${tab}" aria-label="Move up">↑</button>` : ""}
        ${index < total - 1 ? `<button class="btn-secondary btn-small" type="submit" name="action" value="move-nav-down:${tab}" aria-label="Move down">↓</button>` : ""}
      </div>
    </div>`;
}

function renderWidgetRow(widget: { id: HomeWidgetId; visible: boolean }, index: number, total: number): string {
  return `
    <div class="widget-row">
      <label class="widget-row-label">
        <input type="checkbox" name="widget-${widget.id}" ${widget.visible ? "checked" : ""} />
        ${escapeHtml(WIDGET_LABELS[widget.id] ?? widget.id)}
      </label>
      <div class="widget-row-controls">
        ${index > 0 ? `<button class="btn-secondary btn-small" type="submit" name="action" value="move-up:${widget.id}" aria-label="Move up">↑</button>` : ""}
        ${index < total - 1 ? `<button class="btn-secondary btn-small" type="submit" name="action" value="move-down:${widget.id}" aria-label="Move down">↓</button>` : ""}
      </div>
    </div>`;
}

// Same reorderable-row pattern as renderWidgetRow, on distinct action
// names (move-fin-up/down vs move-up/down) and checkbox prefix
// (fin-widget- vs widget-) so the same Dashboard form can tell a
// Finance-widget click apart from a Home-widget click.
function renderFinanceWidgetRow(widget: { id: FinanceWidgetId; visible: boolean }, index: number, total: number): string {
  return `
    <div class="widget-row">
      <label class="widget-row-label">
        <input type="checkbox" name="fin-widget-${widget.id}" ${widget.visible ? "checked" : ""} />
        ${escapeHtml(FINANCE_WIDGET_LABELS[widget.id] ?? widget.id)}
      </label>
      <div class="widget-row-controls">
        ${index > 0 ? `<button class="btn-secondary btn-small" type="submit" name="action" value="move-fin-up:${widget.id}" aria-label="Move up">↑</button>` : ""}
        ${index < total - 1 ? `<button class="btn-secondary btn-small" type="submit" name="action" value="move-fin-down:${widget.id}" aria-label="Move down">↓</button>` : ""}
      </div>
    </div>`;
}

export function buildSettingsHtml(
  settings: Settings,
  classFolders: ClassFolder[],
  watchlistEntries: WatchlistEntry[],
  reminderGroups: ReminderGroup[],
  communityFeedSources: CommunityFeedSource[],
  sessions: SessionInfo[],
  currentSessionId: string | null,
  manualBills: ManualBill[],
  saved: boolean,
  error?: string
): string {
  const body = `
    <div class="section">
      <h1 class="page-title">Settings</h1>
    </div>
    ${saved ? `<p class="hint" style="margin-bottom:20px;">Saved.</p>` : ""}
    ${error === "invalid-link" ? `<p class="hint" style="margin-bottom:20px;color:var(--danger);">Couldn't read that Drive folder link — paste the full share link.</p>` : ""}

    <section class="section card">
      <h1 class="section-title">Appearance</h1>
      <div class="field" style="flex-direction: row; align-items: center; justify-content: space-between;">
        <label style="margin:0;">Theme</label>
        <button type="button" class="btn-secondary btn-small" id="settings-theme-toggle">
          <span id="settings-theme-icon">&#x1F319;</span> Toggle
        </button>
      </div>
    </section>

    <section class="section card" style="margin-top: 16px;">
      <h1 class="section-title">Brief settings</h1>
      <form class="settings-form" method="POST" action="/api/donna-settings">
        <input type="hidden" name="action" value="save-settings" />

        <div class="field">
          <label for="timezone">Timezone</label>
          <input class="input-mono" type="text" id="timezone" name="timezone" value="${escapeHtml(settings.timezone)}" />
          <div class="hint">An IANA timezone name, e.g. America/New_York</div>
        </div>

        <div class="field">
          <label for="newsletterQuery">Newsletter search query</label>
          <input class="input-mono" type="text" id="newsletterQuery" name="newsletterQuery" value="${escapeHtml(settings.newsletterQuery)}" />
          <div class="hint">Gmail search syntax, e.g. newer_than:2d label:newsletters</div>
        </div>

        <button class="btn" type="submit">Save</button>
      </form>
      <p class="hint">Reminders now live in Google Tasks — check the Reminders page, or ask Donna to add or check them off.</p>
    </section>

    <section class="section card" style="margin-top: 16px;">
      <h1 class="section-title">Dashboard</h1>
      <form id="dashboard-settings-form" class="settings-form" method="POST" action="/api/donna-settings">
        <div class="field">
          <label>Home cards</label>
          ${settings.dashboardConfig.homeWidgets
            .map((w, i) => renderWidgetRow(w, i, settings.dashboardConfig.homeWidgets.length))
            .join("\n")}
          <div class="hint">Uncheck a card to hide it from Home, or use the arrows to reorder.</div>
        </div>

        <div class="field">
          <label>Finance page widgets</label>
          ${settings.dashboardConfig.financeWidgets
            .map((w, i) => renderFinanceWidgetRow(w, i, settings.dashboardConfig.financeWidgets.length))
            .join("\n")}
          <div class="hint">Uncheck a widget to hide it from the Finances page, or use the arrows to reorder.</div>
        </div>

        <div class="field">
          <label for="defaultHomeTab">Default Home tab</label>
          <select class="input-mono" id="defaultHomeTab" name="defaultHomeTab">
            <option value="news" ${settings.dashboardConfig.defaultHomeTab === "news" ? "selected" : ""}>News</option>
            <option value="newsletters" ${settings.dashboardConfig.defaultHomeTab === "newsletters" ? "selected" : ""}>Newsletters</option>
          </select>
        </div>

        <div class="field">
          <label>Sidebar pages</label>
          ${settings.dashboardConfig.navOrder
            .map((tab, i) =>
              renderNavRow(
                tab,
                settings.dashboardConfig.navVisibility[tab as keyof NavVisibility],
                i,
                settings.dashboardConfig.navOrder.length
              )
            )
            .join("\n")}
          <div class="hint">Home and Settings always stay in nav (Home first, Settings last). Uncheck a page to hide it, or use the arrows to reorder — order also decides which pages show directly on the mobile bottom bar vs. under "More".</div>
        </div>

        <button class="btn" type="submit" name="action" value="save-dashboard-settings">Save</button>
      </form>
    </section>

    <section class="section card" style="margin-top: 16px;">
      <h1 class="section-title">Morning text</h1>
      <form class="settings-form" method="POST" action="/api/donna-settings">
        <input type="hidden" name="action" value="save-brief-settings" />
        <div class="field">
          <label for="sendTime">Send time</label>
          <input class="input-mono" type="time" id="sendTime" name="sendTime" value="${escapeHtml(settings.briefConfig.sendTime)}" style="width: 120px;" />
          <div class="hint">In your timezone above. Checked every 5 minutes, so it may land up to that long after this time.</div>
        </div>

        <div class="field">
          <label class="widget-row-label">
            <input type="checkbox" name="news" ${settings.briefConfig.news ? "checked" : ""} />
            News headlines
          </label>
          <label class="widget-row-label">
            <input type="checkbox" name="calendar" ${settings.briefConfig.calendar ? "checked" : ""} />
            Today's calendar
          </label>
          <label class="widget-row-label">
            <input type="checkbox" name="reminders" ${settings.briefConfig.reminders ? "checked" : ""} />
            Reminders
          </label>
          <label class="widget-row-label">
            <input type="checkbox" name="ipos" ${settings.briefConfig.ipos ? "checked" : ""} />
            IPO filings
          </label>
          <div class="hint">News and newsletters still show up on the dashboard either way — this only controls what gets texted.</div>
        </div>

        <div class="field">
          <label for="headlineCount">Headlines to text</label>
          <input class="input-mono" type="number" id="headlineCount" name="headlineCount" min="1" max="8" value="${settings.briefConfig.headlineCount}" style="width: 80px;" />
        </div>

        <div class="field">
          <label class="widget-row-label">
            <input type="checkbox" name="weeklyDigestEnabled" ${settings.briefConfig.weeklyDigestEnabled ? "checked" : ""} />
            Weekly digest
          </label>
          <div class="hint">An extra "week ahead" text alongside the regular morning brief — upcoming calendar events and reminders due that week.</div>
          <label for="weeklyDigestDay" style="margin-top: 8px;">Send on</label>
          <select id="weeklyDigestDay" name="weeklyDigestDay">
            ${["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
              .map(
                (day, i) =>
                  `<option value="${i}" ${settings.briefConfig.weeklyDigestDay === i ? "selected" : ""}>${day}</option>`
              )
              .join("\n")}
          </select>
        </div>

        <button class="btn" type="submit">Save</button>
      </form>
    </section>

    <section class="section card" style="margin-top: 16px;">
      <h1 class="section-title">Watchlist</h1>
      ${renderWatchlistRows(watchlistEntries)}

      <form class="add-class-form" method="POST" action="/api/donna-settings">
        <input type="hidden" name="action" value="add-watchlist-entry" />
        <input type="text" name="label" placeholder="Company or ticker, e.g. Klarna or KLAR" required />
        <button class="btn" type="submit">Add</button>
      </form>
      <div class="hint">A watchlist mention gets priority in the daily news picks and a badge in the feed.</div>
    </section>

    <section class="section card" style="margin-top: 16px;">
      <h1 class="section-title">Community Feeds</h1>
      ${renderCommunityFeedRows(communityFeedSources)}

      <form class="add-class-form" method="POST" action="/api/donna-settings">
        <input type="hidden" name="action" value="add-community-feed-source" />
        <input type="text" name="label" placeholder="Label, e.g. r/investing" required />
        <input type="text" name="url" placeholder="RSS feed URL" required style="flex: 2 1 220px;" />
        <button class="btn" type="submit">Add</button>
      </form>
      <div class="hint">Raw RSS sources for Home's Community tab — no curation, just a chronological list.</div>
    </section>

    <section class="section card" style="margin-top: 16px;">
      <h1 class="section-title">Classes</h1>
      ${renderClassRows(classFolders)}

      <form class="add-class-form" method="POST" action="/api/donna-settings">
        <input type="hidden" name="action" value="add-class" />
        <input type="text" name="className" placeholder="Class name, e.g. ECO 301" required />
        <input type="text" name="driveFolderLink" placeholder="Paste Drive folder link" required />
        <button class="btn" type="submit">Add</button>
      </form>
      <div class="hint">Paste a Drive folder's share link — Donna extracts the folder ID automatically.</div>
    </section>

    <section class="section card" style="margin-top: 16px;">
      <h1 class="section-title">Reminder Groups</h1>
      ${renderReminderGroupRows(reminderGroups)}

      <form class="add-class-form" method="POST" action="/api/donna-settings">
        <input type="hidden" name="action" value="add-reminder-group" />
        <input type="text" name="name" placeholder="Group name, e.g. Work" required />
        <input type="color" name="color" value="#b86b45" />
        <button class="btn" type="submit">Add</button>
      </form>
      <div class="hint">Color-codes and groups your reminders — independent of class links, so a reminder can have both.</div>
    </section>

    <section class="section card" style="margin-top: 16px;">
      <h1 class="section-title">Manual Bills</h1>
      ${renderManualBillRows(manualBills)}

      <form class="add-class-form" method="POST" action="/api/donna-settings">
        <input type="hidden" name="action" value="add-manual-bill" />
        <input type="text" name="name" placeholder="Bill name, e.g. Rent" required />
        <input type="number" name="amount" placeholder="Amount" min="0" step="0.01" required style="width:100px;" />
        <input type="number" name="dueDay" placeholder="Due day" min="1" max="31" required style="width:90px;" />
        <button class="btn" type="submit">Add</button>
      </form>
      <div class="hint">For bills Plaid can't see (rent paid outside a linked account, etc.) — shows up alongside auto-detected recurring charges in the Finances page's Upcoming Payments widget.</div>
    </section>

    <section class="section card" style="margin-top: 16px;">
      <h1 class="section-title">Sessions</h1>
      ${renderSessionRows(sessions, currentSessionId)}

      <div style="margin-top: var(--sp-2); display:flex; gap: var(--sp-2); flex-wrap: wrap;">
        <a class="btn btn-secondary" href="/donna/logout">Sign out of this device</a>
        ${
          sessions.length > 1
            ? `<form method="POST" action="/api/donna-settings" onsubmit="return confirm('Sign out every other device? This one stays signed in.');">
          <input type="hidden" name="action" value="revoke-other-sessions" />
          <button class="btn btn-danger" type="submit">Sign out all other devices</button>
        </form>`
            : ""
        }
      </div>
      <div class="hint">If your phone or laptop is ever lost, sign it out here from any other device — it takes effect immediately, without changing your password.</div>
    </section>

    <section class="section card" style="margin-top: 16px;">
      <details id="how-this-works">
        <summary class="section-title" style="cursor:pointer;">How this works</summary>
        <div style="margin-top: var(--sp-2);">
          ${HOW_THIS_WORKS.map(renderHowThisWorksSection).join("\n")}
        </div>
      </details>
    </section>`;

  return renderLayout({
    title: "Donna Settings",
    activeTab: "settings",
    bodyHtml: body,
    showChatFab: true,
    navVisibility: settings.dashboardConfig.navVisibility,
    navOrder: settings.dashboardConfig.navOrder,
    // The sidebar's info icon links here with a #how-this-works
    // fragment — a hard load lands on it natively, but the client-side
    // router's swap doesn't trigger the browser's own fragment-reveal
    // behavior, so this handles both cases directly.
    pageScript: SETTINGS_CLIENT_SCRIPT,
  });
}

const SETTINGS_CLIENT_SCRIPT = `
(function () {
  // Moved here from the sidebar/mobile menu — this button and its icon
  // are part of Settings' own swapped content, so (unlike the old
  // persistent-shell version) a plain direct bind is safe: the element is
  // destroyed and recreated in lockstep with this script re-running on
  // every visit, never stale.
  (function () {
    const btn = document.getElementById("settings-theme-toggle");
    const icon = document.getElementById("settings-theme-icon");
    if (!btn || !icon) return;

    function effectiveTheme() {
      const explicit = document.documentElement.getAttribute("data-theme");
      if (explicit) return explicit;
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    function updateIcon() {
      icon.textContent = effectiveTheme() === "dark" ? "☀️" : "🌙";
    }
    btn.addEventListener("click", () => {
      const next = effectiveTheme() === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      try { localStorage.setItem("donna-theme", next); } catch (e) {}
      updateIcon();
    });
    updateIcon();
  })();

  if (window.location.hash === "#how-this-works") {
    const details = document.getElementById("how-this-works");
    if (details) {
      details.open = true;
      details.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  // Dashboard reorder buttons (move-up/move-down/move-nav-*/move-fin-*) —
  // intercept just those, not the form's "Save" button, so Save keeps its
  // existing full-page "Saved." confirmation while reordering becomes
  // instant. This script re-runs on every client-routed visit to Settings
  // (it's inline in #page-content, re-executed by the router's runScripts),
  // so the window flag stops a duplicate listener stacking up each time.
  if (window.__dashboardReorderBound) return;
  window.__dashboardReorderBound = true;

  document.addEventListener("click", function (e) {
    const btn = e.target && e.target.closest && e.target.closest('button[name="action"][value^="move-"]');
    if (!btn) return;
    const form = btn.closest("form");
    if (!form) return;
    e.preventDefault();

    const formData = new FormData(form);
    formData.append(btn.name, btn.value);

    fetch(form.action, { method: "POST", body: formData })
      .then(function (res) {
        if (!res.ok) throw new Error("bad status " + res.status);
        return res.text();
      })
      .then(function (text) {
        const doc = new DOMParser().parseFromString(text, "text/html");
        const newForm = doc.getElementById("dashboard-settings-form");
        if (newForm) form.replaceWith(newForm);
      })
      .catch(function () {
        // Fall back to a real submission — never leave the click doing nothing.
        form.requestSubmit(btn);
      });
  });
})();
`;
