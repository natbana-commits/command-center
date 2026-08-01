import type { HomeWidgetId, NavVisibility, Settings } from "../config.js";
import type { ClassFolder } from "../drive/classFolders.js";
import type { WatchlistEntry } from "../news/watchlist.js";
import { escapeHtml } from "../util/html.js";
import { renderLayout } from "./layout.js";
import { NAV_TAB_LABELS } from "./nav.js";

const WIDGET_LABELS: Record<HomeWidgetId, string> = {
  "recent-activity": "Recent Activity",
  upcoming: "Upcoming",
  reminders: "Reminders",
  contacts: "Contacts",
  files: "Files",
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

export function buildSettingsHtml(
  settings: Settings,
  classFolders: ClassFolder[],
  watchlistEntries: WatchlistEntry[],
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
          <div class="hint">News and newsletters still show up on the dashboard either way — this only controls what gets texted.</div>
        </div>

        <div class="field">
          <label for="headlineCount">Headlines to text</label>
          <input class="input-mono" type="number" id="headlineCount" name="headlineCount" min="1" max="8" value="${settings.briefConfig.headlineCount}" style="width: 80px;" />
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
      <h1 class="section-title">Classes</h1>
      ${renderClassRows(classFolders)}

      <form class="add-class-form" method="POST" action="/api/donna-settings">
        <input type="hidden" name="action" value="add-class" />
        <input type="text" name="className" placeholder="Class name, e.g. ECO 301" required />
        <input type="text" name="driveFolderLink" placeholder="Paste Drive folder link" required />
        <button class="btn" type="submit">Add</button>
      </form>
      <div class="hint">Paste a Drive folder's share link — Donna extracts the folder ID automatically.</div>
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
