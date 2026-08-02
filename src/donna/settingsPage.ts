import type { HomeWidgetId, FinanceWidgetId, NavVisibility, Settings } from "../config.js";
import type { ClassFolder } from "../drive/classFolders.js";
import type { WatchlistEntry } from "../news/watchlist.js";
import type { ReminderGroup } from "../reminders/groups.js";
import type { CommunityFeedSource } from "../news/communityFeeds.js";
import type { SessionInfo } from "../auth/session.js";
import { escapeHtml } from "../util/html.js";
import { renderLayout } from "./layout.js";
import { NAV_TAB_LABELS } from "./nav.js";

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
      <form class="settings-form" method="POST" action="/api/donna-settings">
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
      <h1 class="section-title">Sessions</h1>
      ${renderSessionRows(sessions, currentSessionId)}

      ${
        sessions.length > 1
          ? `<form method="POST" action="/api/donna-settings" style="margin-top: var(--sp-2);" onsubmit="return confirm('Sign out every other device? This one stays signed in.');">
        <input type="hidden" name="action" value="revoke-other-sessions" />
        <button class="btn btn-danger" type="submit">Sign out all other devices</button>
      </form>`
          : ""
      }
      <div class="hint">If your phone or laptop is ever lost, sign it out here from any other device — it takes effect immediately, without changing your password.</div>
    </section>`;

  return renderLayout({
    title: "Donna Settings",
    activeTab: "settings",
    bodyHtml: body,
    showChatFab: true,
    navVisibility: settings.dashboardConfig.navVisibility,
    navOrder: settings.dashboardConfig.navOrder,
  });
}
