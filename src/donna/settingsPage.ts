import type { HomeWidgetId, FinanceWidgetId, NavVisibility, Settings } from "../config.js";
import type { ClassFolder } from "../drive/classFolders.js";
import type { WatchlistEntry } from "../news/watchlist.js";
import type { ReminderGroup } from "../reminders/groups.js";
import type { CommunityFeedSource } from "../news/communityFeeds.js";
import type { SessionInfo } from "../auth/session.js";
import type { ManualBill } from "../finance/manualBills.js";
import type { RecurringCharge } from "../finance/recurringCharges.js";
import type { RecurringChargeOverride } from "../finance/recurringChargeOverrides.js";
import { escapeHtml } from "../util/html.js";
import { renderLayout } from "./layout.js";
import { NAV_TAB_LABELS } from "./nav.js";
import {
  iconGripVertical,
  iconSettings,
  iconSend,
  iconTrendingUp,
  iconNewspaper,
  iconGraduationCap,
  iconBell,
  iconWallet,
  iconRepeat,
  iconUser,
  iconInfo,
} from "./icons.js";

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
      "Today's newsletters show up right on Home, collapsed by default. Click one to read the full email inline. Only today's are kept here; anything older gets pruned automatically.",
  },
  {
    title: "Calendar",
    description:
      "A 14-day agenda view of your Google Calendar. It's read-only from this page, but you can ask Donna in chat to find a free slot and book something directly, e.g. \"find 30 minutes for a workout tomorrow.\"",
  },
  {
    title: "Reminders",
    description:
      "Backed by Google Tasks, so anything you add also shows up in your real Tasks app, including from the Tasks tab built into the Google Calendar app itself, as long as you file it under the \"Donna Reminders\" list there. Give a reminder a specific time and Donna will actually text you then, not just show a due date. Color-coded groups (School, Life, Personal, etc., managed below) organize reminders independently of class links: sort by due date or switch to grouped view, and the \"+\" button opens a quick add form. You can also link a reminder to a class; linked ones power the \"Upcoming Deadlines\" glance on the Files page.",
  },
  {
    title: "Files",
    description:
      "Each class you set up below gets its own Google Drive folder shown here. Upload a lecture recording and Donna transcribes it (and writes a quick set of notes) automatically; upload a photo or scanned document and it extracts the text. Ask Donna in chat to pull up a class's files as context for homework help.",
  },
  {
    title: "Contacts",
    description:
      "A recruiting/networking tracker: name, firm, bio, a relationship tag (Recruiter, Alum, Mentor, etc.), and a running log of interactions (call, email, coffee chat…) each with its own date and notes. \"Time since last contact\" updates automatically from whichever was most recent. Each contact also has a one-click \"+ Reminder\" button for a follow-up.",
  },
  {
    title: "IPOs",
    description:
      "Once a day Donna checks SEC EDGAR for newly-filed S-1 IPO registrations, reads the filing, and summarizes the business, key financials, deal terms, and notable risk factors, shown here and as a Home glance, with a callout in the morning text when something new filed. It's a best-effort digest of a large document, not a substitute for reading the real filing. \"Follow\" a specific company (from this page or by asking Donna in chat) to also get flagged on its later filings: amendments, or the final priced prospectus, which usually lands well after the initial S-1.",
  },
  {
    title: "Finances",
    description:
      "Link any Plaid-compatible bank, card, or brokerage (Amex, Marcus, PNC, and thousands of others; Fidelity isn't currently supported by Plaid) via the \"+ Link an account\" button. Donna only ever reads balances and recent transactions. She can't move money, initiate a transfer, or place a trade. Access tokens are encrypted before storage, and updates arrive in real time via Plaid's webhooks rather than needing a manual refresh. Unlink an account any time from this page to remove it and its data.",
  },
  {
    title: "School",
    description:
      "Pick a class to see its flashcards and lecture uploads. \"Chat about [class]\" opens a dedicated conversation on the Chat tab that auto-loads that class's Drive files as context and keeps its own separate, persistent history. Generate flashcards from any transcribed lecture upload with one click, then review them on a simple spaced-repetition schedule (cards you get right come back less often; ones you miss come back sooner).",
  },
  {
    title: "Chat",
    description:
      "Donna's the same assistant everywhere: Telegram, the floating chat bubble on every page, and the dedicated Chat tab, which adds a mode switcher across the top. General mode has full tool access (reminders, email search, calendar, IPO lookups); any class you've set up gets auto-loaded Drive context, its own separate history, and a one-click \"Generate practice problems\". The floating bubble is always General mode and shares that same conversation with the Chat tab's General mode, so switching between them mid-conversation picks up right where you left off.",
  },
  {
    title: "Markets & Economic Calendar",
    description:
      "The Markets card (off by default, turn it on above) shows a live price and day change for each ticker on your Watchlist, via Finnhub's free tier. Set FINNHUB_API_KEY to use it. The Upcoming Econ Events card needs no setup: it's a small manually-seeded calendar of FOMC meetings and CPI/jobs/GDP release dates, sourced from the Fed/BLS/BEA's own published schedules rather than a live feed (those dates are published many months ahead, so there's nothing to poll). It only covers what was seeded on 2026-08-01. Refresh it once a year with the next year's official schedule.",
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
  classes: "Classes",
  ipos: "IPOs",
  finances: "Finances",
  markets: "Markets",
  "econ-events": "Upcoming Econ Events",
  news: "News",
};

const FINANCE_WIDGET_LABELS: Record<FinanceWidgetId, string> = {
  "net-worth": "Net Worth",
  "spending-over-time": "Spending Over Time",
  "spending-by-category": "Spending by Category",
  "credit-card-spending": "Credit Card Spending",
  "top-merchants": "Top Merchants",
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
          <div style="display:flex; gap:8px;">
            <button type="button" class="reminder-edit-link" onclick="toggleClassRename(${cls.id})">Rename</button>
            <form method="POST" action="/api/donna-settings">
              <input type="hidden" name="action" value="delete-class" />
              <input type="hidden" name="id" value="${cls.id}" />
              <button class="btn btn-danger" type="submit">Remove</button>
            </form>
          </div>
        </div>
        <form method="POST" action="/api/donna-settings" class="add-class-form" id="class-rename-form-${cls.id}" style="display:none; margin-top:6px;">
          <input type="hidden" name="action" value="rename-class" />
          <input type="hidden" name="id" value="${cls.id}" />
          <input type="text" name="className" value="${escapeHtml(cls.className)}" required />
          <button class="btn btn-small" type="submit">Save</button>
        </form>`
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
          <span>${escapeHtml(b.name)}: $${escapeHtml(b.amount.toFixed(2))}, due the ${escapeHtml(String(b.dueDay))}${escapeHtml(ordinalSuffix(b.dueDay))}</span>
          <div style="display:flex; gap:8px;">
            <button type="button" class="reminder-edit-link" onclick="toggleBillEdit(${b.id})">Edit</button>
            <form method="POST" action="/api/donna-settings">
              <input type="hidden" name="action" value="delete-manual-bill" />
              <input type="hidden" name="id" value="${b.id}" />
              <button class="btn btn-danger" type="submit">Remove</button>
            </form>
          </div>
        </div>
        <form method="POST" action="/api/donna-settings" class="add-class-form" id="bill-edit-form-${b.id}" style="display:none; margin-top:6px;">
          <input type="hidden" name="action" value="update-manual-bill" />
          <input type="hidden" name="id" value="${b.id}" />
          <input type="text" name="name" value="${escapeHtml(b.name)}" required />
          <input type="number" name="amount" value="${b.amount}" min="0" step="0.01" required style="width:100px;" />
          <input type="number" name="dueDay" value="${b.dueDay}" min="1" max="31" required style="width:90px;" />
          <button class="btn btn-small" type="submit">Save</button>
        </form>`
    )
    .join("\n");
}

// Not stored rows — merged from a fresh detection pass (recurringCharges)
// against any saved overrides, so a dismissed merchant still shows up
// here (to restore) even though it's filtered out of the Finances widget.
function renderRecurringChargeOverrideRows(
  recurringCharges: RecurringCharge[],
  overrides: RecurringChargeOverride[]
): string {
  if (recurringCharges.length === 0) {
    return `<p class="empty">No recurring charges detected yet.</p>`;
  }

  const overrideByKey = new Map(overrides.map((o) => [o.merchantKey, o]));

  return recurringCharges
    .map((c) => {
      const override = overrideByKey.get(c.merchantKey);
      const dismissed = override?.dismissed ?? false;
      const displayName = override?.displayName ?? c.label;
      const displayAmount = override?.amountOverride ?? c.averageAmount;
      // Merchant keys can contain characters (quotes, etc.) that would
      // break a bare JS identifier if inlined into onclick — passed as a
      // proper JSON string literal instead.
      const keyArg = JSON.stringify(c.merchantKey);
      const formId = `rc-edit-form-${escapeHtml(encodeURIComponent(c.merchantKey))}`;

      return `
        <div class="class-row"${dismissed ? ' style="opacity:0.55;"' : ""}>
          <span>${escapeHtml(displayName)}: $${escapeHtml(displayAmount.toFixed(2))}/mo${dismissed ? " (dismissed)" : ""}</span>
          <div style="display:flex; gap:8px;">
            ${
              dismissed
                ? `<form method="POST" action="/api/donna-settings">
                    <input type="hidden" name="action" value="restore-recurring-charge" />
                    <input type="hidden" name="merchantKey" value="${escapeHtml(c.merchantKey)}" />
                    <button class="btn btn-small" type="submit">Restore</button>
                  </form>`
                : `<button type="button" class="reminder-edit-link" onclick="toggleRecurringChargeEdit(${keyArg})">Edit</button>
                  <form method="POST" action="/api/donna-settings">
                    <input type="hidden" name="action" value="dismiss-recurring-charge" />
                    <input type="hidden" name="merchantKey" value="${escapeHtml(c.merchantKey)}" />
                    <button class="btn btn-danger" type="submit">Dismiss</button>
                  </form>`
            }
          </div>
        </div>
        <form method="POST" action="/api/donna-settings" class="add-class-form" id="${formId}" style="display:none; margin-top:6px;">
          <input type="hidden" name="action" value="update-recurring-charge-override" />
          <input type="hidden" name="merchantKey" value="${escapeHtml(c.merchantKey)}" />
          <input type="text" name="displayName" value="${escapeHtml(displayName)}" required />
          <input type="number" name="amountOverride" value="${displayAmount}" min="0" step="0.01" required style="width:100px;" />
          <button class="btn btn-small" type="submit">Save</button>
        </form>`;
    })
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

// Same drag-reorderable row shape as renderWidgetRow/renderFinanceWidgetRow —
// data-id is what SETTINGS_CLIENT_SCRIPT's drag handler reads off each row
// to build the new order it posts to reorder-nav.
function renderNavRow(tab: string, visible: boolean): string {
  return `
    <div class="widget-row" data-reorder-row data-id="${escapeHtml(tab)}">
      <button type="button" class="reorder-handle" aria-label="Drag to reorder ${escapeHtml(NAV_TAB_LABELS[tab as keyof typeof NAV_TAB_LABELS] ?? tab)}">${iconGripVertical}</button>
      <label class="widget-row-label">
        <input type="checkbox" name="nav-${tab}" ${visible ? "checked" : ""} />
        ${escapeHtml(NAV_TAB_LABELS[tab as keyof typeof NAV_TAB_LABELS] ?? tab)}
      </label>
    </div>`;
}

function renderWidgetRow(widget: { id: HomeWidgetId; visible: boolean }): string {
  return `
    <div class="widget-row" data-reorder-row data-id="${escapeHtml(widget.id)}">
      <button type="button" class="reorder-handle" aria-label="Drag to reorder ${escapeHtml(WIDGET_LABELS[widget.id] ?? widget.id)}">${iconGripVertical}</button>
      <label class="widget-row-label">
        <input type="checkbox" name="widget-${widget.id}" ${widget.visible ? "checked" : ""} />
        ${escapeHtml(WIDGET_LABELS[widget.id] ?? widget.id)}
      </label>
    </div>`;
}

// Same drag-reorderable row shape as renderWidgetRow, with a distinct
// checkbox prefix (fin-widget- vs widget-) and reorder action
// (reorder-fin-widgets vs reorder-widgets) so the two lists never collide.
function renderFinanceWidgetRow(widget: { id: FinanceWidgetId; visible: boolean }): string {
  return `
    <div class="widget-row" data-reorder-row data-id="${escapeHtml(widget.id)}">
      <button type="button" class="reorder-handle" aria-label="Drag to reorder ${escapeHtml(FINANCE_WIDGET_LABELS[widget.id] ?? widget.id)}">${iconGripVertical}</button>
      <label class="widget-row-label">
        <input type="checkbox" name="fin-widget-${widget.id}" ${widget.visible ? "checked" : ""} />
        ${escapeHtml(FINANCE_WIDGET_LABELS[widget.id] ?? widget.id)}
      </label>
    </div>`;
}

// One --hw-* token (Home's own palette, see tileColor.ts) per section, all
// 11 assigned exactly once so no two sections in the jump-nav read as the
// same color — semantic where an obvious tie to a Home widget exists
// (Watchlist/markets, Community Feeds/news, Classes, Reminder Groups,
// Manual Bills/finance), arbitrary but still unique otherwise.
const SECTION_STYLE: Record<string, { icon: string; token: string }> = {
  "settings-brief": { icon: iconSettings, token: "activity" },
  "settings-dashboard": { icon: iconGripVertical, token: "files" },
  "settings-morning-text": { icon: iconSend, token: "ipos" },
  "settings-watchlist": { icon: iconTrendingUp, token: "markets" },
  "settings-community-feeds": { icon: iconNewspaper, token: "news" },
  "settings-classes": { icon: iconGraduationCap, token: "classes" },
  "settings-reminder-groups": { icon: iconBell, token: "reminders" },
  "settings-manual-bills": { icon: iconWallet, token: "finance" },
  "settings-recurring-charges": { icon: iconRepeat, token: "upcoming" },
  "settings-sessions": { icon: iconUser, token: "contacts" },
  "how-this-works": { icon: iconInfo, token: "econ" },
};

function sectionTintStyle(id: string): string {
  const style = SECTION_STYLE[id];
  return style ? `background-image: linear-gradient(135deg, var(--hw-${style.token}-tint) 0%, var(--card) 45%);` : "";
}

function sectionHeadHtml(id: string, title: string): string {
  const style = SECTION_STYLE[id];
  if (!style) return `<h1 class="section-title">${escapeHtml(title)}</h1>`;
  return `
    <div class="fw-tile-head">
      <div class="fw-icon" style="--accent: var(--hw-${style.token});">${style.icon}</div>
      <h1 class="section-title" style="margin:0;">${escapeHtml(title)}</h1>
    </div>`;
}

function jumpSection(id: string, title: string, innerHtml: string): { id: string; label: string; html: string } {
  return {
    id,
    label: title,
    html: `
    <section class="section card settings-jump-target" id="${escapeHtml(id)}" style="margin-top: 16px; ${sectionTintStyle(id)}">
      ${sectionHeadHtml(id, title)}
      ${innerHtml}
    </section>`,
  };
}

// Nav pills are rendered straight from this array (see renderSettingsNav),
// so it's the single source of truth for both a section's heading and its
// jump-nav entry — add a section here and it appears in the nav for free,
// nothing to keep in sync by hand.
function buildJumpSections(
  settings: Settings,
  classFolders: ClassFolder[],
  watchlistEntries: WatchlistEntry[],
  reminderGroups: ReminderGroup[],
  communityFeedSources: CommunityFeedSource[],
  sessions: SessionInfo[],
  currentSessionId: string | null,
  manualBills: ManualBill[],
  recurringCharges: RecurringCharge[],
  recurringChargeOverrides: RecurringChargeOverride[]
): { id: string; label: string; html: string }[] {
  return [
    jumpSection(
      "settings-brief",
      "Brief settings",
      `
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
      <p class="hint">Reminders now live in Google Tasks. Check the Reminders page, or ask Donna to add or check them off.</p>`
    ),
    jumpSection(
      "settings-dashboard",
      "Dashboard",
      `
      <form id="dashboard-settings-form" class="settings-form" method="POST" action="/api/donna-settings">
        <div class="field">
          <label>Home cards</label>
          <div class="reorder-list" data-reorder-list data-reorder-action="reorder-widgets">
            ${settings.dashboardConfig.homeWidgets.map((w) => renderWidgetRow(w)).join("\n")}
          </div>
          <div class="hint">Uncheck a card to hide it from Home. Reminders is always the large pinned card; order below only affects the other cards' position on narrower screens.</div>
        </div>

        <div class="field">
          <label>Finance page widgets</label>
          <div class="reorder-list" data-reorder-list data-reorder-action="reorder-fin-widgets">
            ${settings.dashboardConfig.financeWidgets.map((w) => renderFinanceWidgetRow(w)).join("\n")}
          </div>
          <div class="hint">Uncheck a widget to hide it from the Finances page, or drag the handle to reorder.</div>
        </div>

        <div class="field">
          <label for="defaultNewsTab">Default News tab</label>
          <select class="input-mono" id="defaultNewsTab" name="defaultNewsTab">
            <option value="news" ${settings.dashboardConfig.defaultNewsTab === "news" ? "selected" : ""}>News</option>
            <option value="newsletters" ${settings.dashboardConfig.defaultNewsTab === "newsletters" ? "selected" : ""}>Newsletters</option>
          </select>
        </div>

        <div class="field">
          <label>Sidebar pages</label>
          <div class="reorder-list" data-reorder-list data-reorder-action="reorder-nav">
            ${settings.dashboardConfig.navOrder
              .map((tab) => renderNavRow(tab, settings.dashboardConfig.navVisibility[tab as keyof NavVisibility]))
              .join("\n")}
          </div>
          <div class="hint">Home and Settings always stay in nav (Home first, Settings last). Uncheck a page to hide it, or drag the handle to reorder: same order on the sidebar and the mobile tab strip.</div>
        </div>

        <button class="btn" type="submit" name="action" value="save-dashboard-settings">Save</button>
      </form>`
    ),
    jumpSection(
      "settings-morning-text",
      "Morning text",
      `
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
          <div class="hint">News and newsletters still show up on the dashboard either way. This only controls what gets texted.</div>
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
          <div class="hint">An extra "week ahead" text alongside the regular morning brief, covering upcoming calendar events and reminders due that week.</div>
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
      </form>`
    ),
    jumpSection(
      "settings-watchlist",
      "Watchlist",
      `
      ${renderWatchlistRows(watchlistEntries)}

      <form class="add-class-form" method="POST" action="/api/donna-settings">
        <input type="hidden" name="action" value="add-watchlist-entry" />
        <input type="text" name="label" placeholder="Company or ticker, e.g. Klarna or KLAR" required />
        <button class="btn" type="submit">Add</button>
      </form>
      <div class="hint">A watchlist mention gets priority in the daily news picks and a badge in the feed.</div>`
    ),
    jumpSection(
      "settings-community-feeds",
      "Community Feeds",
      `
      ${renderCommunityFeedRows(communityFeedSources)}

      <form class="add-class-form" method="POST" action="/api/donna-settings">
        <input type="hidden" name="action" value="add-community-feed-source" />
        <input type="text" name="label" placeholder="Label, e.g. r/investing" required />
        <input type="text" name="url" placeholder="RSS feed URL" required style="flex: 2 1 220px;" />
        <button class="btn" type="submit">Add</button>
      </form>
      <div class="hint">Raw RSS sources for the News tab's Community tab: no curation, just a chronological list.</div>`
    ),
    jumpSection(
      "settings-classes",
      "Classes",
      `
      ${renderClassRows(classFolders)}

      <form class="add-class-form" method="POST" action="/api/donna-settings">
        <input type="hidden" name="action" value="add-class" />
        <input type="text" name="className" placeholder="Class name, e.g. ECO 301" required />
        <input type="text" name="driveFolderLink" placeholder="Paste Drive folder link" required />
        <button class="btn" type="submit">Add</button>
      </form>
      <div class="hint">Paste a Drive folder's share link and Donna extracts the folder ID automatically.</div>`
    ),
    jumpSection(
      "settings-reminder-groups",
      "Reminder Groups",
      `
      ${renderReminderGroupRows(reminderGroups)}

      <form class="add-class-form" method="POST" action="/api/donna-settings">
        <input type="hidden" name="action" value="add-reminder-group" />
        <input type="text" name="name" placeholder="Group name, e.g. Work" required />
        <input type="color" name="color" value="#b86b45" />
        <button class="btn" type="submit">Add</button>
      </form>
      <div class="hint">Color-codes and groups your reminders, independent of class links, so a reminder can have both.</div>`
    ),
    jumpSection(
      "settings-manual-bills",
      "Manual Bills",
      `
      ${renderManualBillRows(manualBills)}

      <form class="add-class-form" method="POST" action="/api/donna-settings">
        <input type="hidden" name="action" value="add-manual-bill" />
        <input type="text" name="name" placeholder="Bill name, e.g. Rent" required />
        <input type="number" name="amount" placeholder="Amount" min="0" step="0.01" required style="width:100px;" />
        <input type="number" name="dueDay" placeholder="Due day" min="1" max="31" required style="width:90px;" />
        <button class="btn" type="submit">Add</button>
      </form>
      <div class="hint">For bills Plaid can't see (rent paid outside a linked account, etc.). Shows up alongside auto-detected recurring charges in the Finances page's Upcoming Payments widget.</div>`
    ),
    jumpSection(
      "settings-recurring-charges",
      "Recurring Charges",
      `
      ${renderRecurringChargeOverrideRows(recurringCharges, recurringChargeOverrides)}
      <div class="hint">Detected automatically from your transactions. Rename one, correct its amount, or dismiss it if it's not actually recurring.</div>`
    ),
    jumpSection(
      "settings-sessions",
      "Sessions",
      `
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
      <div class="hint">If your phone or laptop is ever lost, sign it out here from any other device. It takes effect immediately, without changing your password.</div>`
    ),
    {
      id: "how-this-works",
      label: "How this works",
      html: `
    <section class="section card" style="margin-top: 16px; ${sectionTintStyle("how-this-works")}">
      <details id="how-this-works" class="settings-jump-target">
        <summary class="section-title" style="cursor:pointer;">
          <span class="fw-tile-head" style="display:inline-flex; margin-bottom:0;">
            <span class="fw-icon" style="--accent: var(--hw-econ);">${SECTION_STYLE["how-this-works"].icon}</span>
            How this works
          </span>
        </summary>
        <div style="margin-top: var(--sp-2);">
          ${HOW_THIS_WORKS.map(renderHowThisWorksSection).join("\n")}
        </div>
      </details>
    </section>`,
    },
  ];
}

function renderSettingsNav(items: { id: string; label: string }[]): string {
  const pills = items
    .map((s) => `<a class="settings-nav-pill" href="#${escapeHtml(s.id)}">${escapeHtml(s.label)}</a>`)
    .join("\n");
  return `
    <nav class="settings-nav" aria-label="Settings sections">
      <div class="settings-nav-pills">${pills}</div>
      <button type="button" class="settings-nav-pill settings-nav-theme-btn" id="settings-theme-toggle">
        <span id="settings-theme-icon">&#x1F319;</span> Theme
      </button>
    </nav>`;
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
  recurringCharges: RecurringCharge[],
  recurringChargeOverrides: RecurringChargeOverride[],
  saved: boolean,
  error?: string
): string {
  const jumpSections = buildJumpSections(
    settings,
    classFolders,
    watchlistEntries,
    reminderGroups,
    communityFeedSources,
    sessions,
    currentSessionId,
    manualBills,
    recurringCharges,
    recurringChargeOverrides
  );

  const body = `
    <div class="section">
      <h1 class="page-title">Settings</h1>
    </div>
    ${saved ? `<p class="hint" style="margin-bottom:20px;">Saved.</p>` : ""}
    ${error === "invalid-link" ? `<p class="hint" style="margin-bottom:20px;color:var(--danger);">Couldn't read that Drive folder link. Paste the full share link.</p>` : ""}

    ${renderSettingsNav(jumpSections)}

    ${jumpSections.map((s) => s.html).join("\n")}`;

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
  // Referenced by an inline onclick="" attribute, which looks up
  // identifiers on the global scope — needs the explicit window
  // assignment despite this whole script being wrapped in an IIFE.
  function toggleClassRename(id) {
    const form = document.getElementById("class-rename-form-" + id);
    if (form) form.style.display = form.style.display === "none" ? "flex" : "none";
  }
  window.toggleClassRename = toggleClassRename;

  function toggleBillEdit(id) {
    const form = document.getElementById("bill-edit-form-" + id);
    if (form) form.style.display = form.style.display === "none" ? "flex" : "none";
  }
  window.toggleBillEdit = toggleBillEdit;

  function toggleRecurringChargeEdit(merchantKey) {
    const form = document.getElementById("rc-edit-form-" + encodeURIComponent(merchantKey));
    if (form) form.style.display = form.style.display === "none" ? "flex" : "none";
  }
  window.toggleRecurringChargeEdit = toggleRecurringChargeEdit;

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

  // The section nav pills drive scrolling explicitly via scrollIntoView
  // rather than relying on the browser's native #anchor jump — a plain
  // href="#id" click was landing on the target and then jumping straight
  // back to the top of the page a moment later (this sticky nav sits in a
  // scroll container that appears to fight native fragment navigation;
  // explicit JS scrolling sidesteps it entirely rather than chasing the
  // exact cause). preventDefault here also means the click never reaches
  // the router's own click handling, so there's no separate fetch+swap
  // triggered either.
  document.querySelectorAll('.settings-nav-pill[href^="#"]').forEach(function (pill) {
    pill.addEventListener("click", function (e) {
      const id = pill.getAttribute("href").slice(1);
      const target = document.getElementById(id);
      if (!target) return;
      e.preventDefault();
      if (id === "how-this-works") target.open = true;
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      history.replaceState(null, "", "#" + id);
    });
  });

  // Touch-friendly drag-to-reorder for the three lists on this page (Home
  // cards, Finance widgets, Sidebar pages) — replaces the old up/down
  // arrow buttons entirely. Each [data-reorder-list] posts its new order
  // as a standalone request (not the whole Dashboard form) the moment a
  // drag ends, so it never touches unsaved checkbox/select edits sitting
  // elsewhere in that form. Elements here live inside #page-content and
  // are destroyed/recreated by the router on every visit (see the theme
  // toggle above), so — unlike the old document-level click listener this
  // replaces — plain addEventListener needs no dedupe guard.
  function initReorderList(list) {
    const action = list.getAttribute("data-reorder-action");
    let dragRow = null;
    let startY = 0;
    let startIndex = 0;
    let rowHeight = 0;

    function rows() {
      return Array.prototype.slice.call(list.children);
    }

    function saveOrder() {
      const order = rows()
        .map(function (r) { return r.getAttribute("data-id"); })
        .join(",");
      fetch("/api/donna-settings", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "action=" + encodeURIComponent(action) + "&order=" + encodeURIComponent(order),
      }).catch(function () {});
    }

    list.addEventListener("pointerdown", function (e) {
      const handle = e.target.closest && e.target.closest(".reorder-handle");
      if (!handle) return;
      const row = handle.closest("[data-reorder-row]");
      if (!row || row.parentElement !== list) return;
      dragRow = row;
      startY = e.clientY;
      startIndex = rows().indexOf(row);
      rowHeight = row.getBoundingClientRect().height;
      row.classList.add("widget-row-dragging");
      handle.setPointerCapture(e.pointerId);
      e.preventDefault();
    });

    // Computes the target slot directly from total distance dragged,
    // divided by row height, rather than the previous approach (comparing
    // the dragged row's live geometry against each sibling's, one pairwise
    // swap at a time). That geometry-feedback-loop version was fragile in
    // practice — dragging into the middle of the list would only ever
    // land at the very top or bottom. Computing the target index directly
    // has no such feedback loop to go wrong: it's pure arithmetic on the
    // pointer's own displacement, independent of any DOM measurement.
    list.addEventListener("pointermove", function (e) {
      if (!dragRow) return;
      const deltaY = e.clientY - startY;
      dragRow.style.transform = "translateY(" + deltaY + "px)";
      if (!rowHeight) return;

      const allRows = rows();
      const shift = Math.round(deltaY / rowHeight);
      const targetIndex = Math.max(0, Math.min(allRows.length - 1, startIndex + shift));
      const currentIndex = allRows.indexOf(dragRow);
      if (targetIndex === currentIndex) return;

      const ref = targetIndex < currentIndex ? allRows[targetIndex] : allRows[targetIndex].nextSibling;
      list.insertBefore(dragRow, ref);

      // The row's own native (untransformed) position in the list just
      // shifted by this swap — without folding that into startY/startIndex,
      // the transform below keeps counting the move insertBefore already
      // made, on top of itself, so the row visually jumps roughly double
      // the intended distance on every swap ("shoots up" instead of
      // tracking the pointer).
      startIndex = targetIndex;
      startY += shift * rowHeight;
      dragRow.style.transform = "translateY(" + (e.clientY - startY) + "px)";
    });

    function endDrag() {
      if (!dragRow) return;
      dragRow.classList.remove("widget-row-dragging");
      dragRow.style.transform = "";
      dragRow = null;
      rowHeight = 0;
      saveOrder();
    }
    list.addEventListener("pointerup", endDrag);
    list.addEventListener("pointercancel", endDrag);

    // Keyboard fallback (Arrow Up/Down while a handle is focused) — the
    // arrow buttons this replaces were natively keyboard-operable, so this
    // keeps that true without needing them back.
    list.addEventListener("keydown", function (e) {
      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
      const handle = e.target.closest && e.target.closest(".reorder-handle");
      if (!handle) return;
      const row = handle.closest("[data-reorder-row]");
      if (!row) return;
      e.preventDefault();
      if (e.key === "ArrowUp" && row.previousElementSibling) {
        list.insertBefore(row, row.previousElementSibling);
      } else if (e.key === "ArrowDown" && row.nextElementSibling) {
        list.insertBefore(row.nextElementSibling, row);
      }
      handle.focus();
      saveOrder();
    });
  }

  const reorderLists = document.querySelectorAll("[data-reorder-list]");
  for (let i = 0; i < reorderLists.length; i++) {
    initReorderList(reorderLists[i]);
  }
})();
`;
