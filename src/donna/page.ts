import type { DailyContext } from "../chat/dailyContext.js";
import type { DashboardConfig, HomeWidgetId } from "../config.js";
import type { Contact } from "../contacts/store.js";
import type { ClassFolder } from "../drive/classFolders.js";
import type { StoredNewsletter } from "../gmail/store.js";
import type { Reminder } from "../google/tasks.js";
import type { ReminderNotification } from "../reminders/notifications.js";
import type { ReminderGroup } from "../reminders/groups.js";
import type { Upload } from "../storage/uploads.js";
import type { IpoFiling } from "../ipos/store.js";
import type { PlaidAccount } from "../finance/accounts.js";
import type { PlaidTransaction } from "../finance/transactionsStore.js";
import type { CalendarEvent } from "../calendar.js";
import type { Quote } from "../markets/quotes.js";
import type { EconomicEvent } from "../markets/economicEvents.js";
import type { CommunityFeedItem } from "../news/communityFeeds.js";
import { escapeHtml } from "../util/html.js";
import { formatRelativeTime, withTimeSuffix } from "../util/time.js";
import { renderLayout } from "./layout.js";
import { iconBell, iconCalendar, iconFolder, iconUser, iconTrendingUp, iconWallet, iconChevronDown } from "./icons.js";
const iconMarkets = iconTrendingUp;
const iconEconEvents = iconCalendar;
import { renderSourceBadge } from "./sourceBadge.js";
import { effectiveDue, formatDue } from "./remindersPage.js";

// Nav destination each Home card links to on click — reuses the same
// hrefs nav.ts's MIDDLE_TAB_META already defines, kept here as a plain
// map rather than importing that module to avoid coupling Home's card
// rendering to the full nav-tab type surface for just seven strings.
const CARD_HREFS: Record<HomeWidgetId, string> = {
  "recent-activity": "/donna/files",
  upcoming: "/donna/calendar",
  reminders: "/donna/reminders",
  contacts: "/donna/contacts",
  files: "/donna/files",
  ipos: "/donna/ipos",
  finances: "/donna/finances",
  markets: "/donna/settings",
  "econ-events": "/donna/calendar",
};

function formatMoney(amount: number, currency: string | null): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency ?? "USD" }).format(amount);
}

function formatFullDate(day: string, timezone: string): string {
  // `day` is a plain YYYY-MM-DD key with no time component; anchor it at
  // noon before formatting so timezone conversion can't roll it to the
  // adjacent calendar date.
  return new Date(`${day}T12:00:00`).toLocaleDateString("en-US", {
    timeZone: timezone,
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function greetingWord(timezone: string): string {
  const hour = Number(
    new Date().toLocaleTimeString("en-US", { timeZone: timezone, hour: "numeric", hour12: false })
  );
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function renderMiniDayEvents(events: CalendarEvent[], timezone: string): string {
  if (events.length === 0) {
    return `<p class="empty" style="margin:4px 0 0;">Nothing scheduled.</p>`;
  }
  return events
    .slice(0, 3)
    .map((e) => {
      const timeLabel = e.start.toLocaleTimeString("en-US", { timeZone: timezone, hour: "numeric", minute: "2-digit" });
      return `
        <div class="agenda-event-row">
          <div class="agenda-event-time">${escapeHtml(timeLabel)}</div>
          <div class="agenda-event-title">${escapeHtml(e.summary)}</div>
        </div>`;
    })
    .join("\n");
}

// Mini today/tomorrow agenda — a fresh 2-day fetch (api/donna.ts), not the
// day's cached DailyContext, which only ever carries *today's* events.
function renderCalendarCard(todayEvents: CalendarEvent[], tomorrowEvents: CalendarEvent[], timezone: string): string {
  return `
    <div class="mini-day-group">
      <div class="mini-day-label">Today</div>
      ${renderMiniDayEvents(todayEvents, timezone)}
    </div>
    <div class="mini-day-group">
      <div class="mini-day-label">Tomorrow</div>
      ${renderMiniDayEvents(tomorrowEvents, timezone)}
    </div>`;
}

function uploadLabel(u: Upload): string {
  const kindLabel = u.kind === "lecture" ? "Transcript" : "Scan";
  return `${kindLabel}: ${u.originalFilename}`;
}

function renderRecentActivityCard(uploads: Upload[]): string {
  if (uploads.length === 0) {
    return `<p class="empty">No recent activity.</p>`;
  }
  return uploads
    .slice(0, 4)
    .map(
      (u) => `
        <div class="agenda-event-row">
          <div class="agenda-event-title">${escapeHtml(uploadLabel(u))}</div>
          <div class="agenda-event-time">${escapeHtml(formatRelativeTime(u.createdAt))}</div>
        </div>`
    )
    .join("\n");
}

function renderRemindersCard(
  reminders: Reminder[],
  googleConfigured: boolean,
  notifications: Map<string, ReminderNotification>,
  timezone: string,
  reminderGroups: ReminderGroup[],
  groupLinks: Map<string, number>
): string {
  if (!googleConfigured) {
    return `<p class="empty">Not connected yet — finish Google setup to use reminders.</p>`;
  }
  if (reminders.length === 0) {
    return `<p class="empty">No reminders.</p>`;
  }
  const groupById = new Map(reminderGroups.map((g) => [g.id, g]));
  return [...reminders]
    .sort((a, b) => {
      const dueA = effectiveDue(a, notifications.get(a.id));
      const dueB = effectiveDue(b, notifications.get(b.id));
      if (!dueA && !dueB) return 0;
      if (!dueA) return 1;
      if (!dueB) return -1;
      return new Date(dueA).getTime() - new Date(dueB).getTime();
    })
    .slice(0, 4)
    .map((r) => {
      const due = effectiveDue(r, notifications.get(r.id));
      const dueDate = due ? new Date(due) : null;
      const overdue = dueDate ? dueDate.getTime() < Date.now() : false;
      const isToday = dueDate ? new Date().toDateString() === dueDate.toDateString() : false;
      const rowClass = overdue ? "reminder-row-overdue" : isToday ? "reminder-row-today" : "";
      const dueBadge = due
        ? `<span class="reminder-due${overdue ? " reminder-due-overdue" : ""}">${escapeHtml(formatDue(due, timezone))}</span>`
        : "";
      const group = groupById.get(groupLinks.get(r.id) ?? -1);
      const groupPill = group
        ? `<span class="reminder-due" style="color:${escapeHtml(group.color)}; background:${escapeHtml(group.color)}1a;">${escapeHtml(group.name)}</span>`
        : "";
      return `
        <div class="reminder-row ${rowClass}">
          <div class="reminder-body">
            <span class="reminder-title">${escapeHtml(withTimeSuffix(r.title, null))}</span>
            <div class="interaction-meta">
              ${dueBadge}
              ${groupPill}
            </div>
          </div>
        </div>`;
    })
    .join("\n");
}

function renderContactsCard(contacts: Contact[]): string {
  if (contacts.length === 0) {
    return `<p class="empty">No contacts tracked yet.</p>`;
  }
  const staleCutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const staleCount = contacts.filter(
    (c) => !c.lastContactedAt || new Date(`${c.lastContactedAt}T12:00:00`).getTime() < staleCutoff
  ).length;
  const plural = contacts.length === 1 ? "" : "s";
  const summary =
    staleCount > 0
      ? `${contacts.length} contact${plural} tracked, ${staleCount} not contacted in 30+ days`
      : `${contacts.length} contact${plural} tracked, all caught up`;
  return `<p class="hint" style="margin:0;">${escapeHtml(summary)}</p>`;
}

function renderFilesCard(
  classFolders: ClassFolder[],
  reminders: Reminder[],
  classLinks: Map<string, number>
): string {
  const classNameById = new Map(classFolders.map((c) => [c.id, c.className]));
  const deadlines = reminders
    .filter((r) => r.due && classNameById.has(classLinks.get(r.id) ?? -1))
    .sort((a, b) => (a.due! < b.due! ? -1 : 1))
    .slice(0, 3);

  if (deadlines.length === 0) {
    return `<p class="empty">No upcoming deadlines.</p>`;
  }

  return deadlines
    .map((r) => {
      const className = classNameById.get(classLinks.get(r.id)!) ?? "";
      const dateLabel = new Date(r.due!).toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const title = className ? `${className}: ${withTimeSuffix(r.title, null)}` : withTimeSuffix(r.title, null);
      return `
        <div class="agenda-event-row">
          <div class="agenda-event-title">${escapeHtml(title)}</div>
          <div class="agenda-event-time">${escapeHtml(dateLabel)}</div>
        </div>`;
    })
    .join("\n");
}

function renderIposCard(filings: IpoFiling[]): string {
  if (filings.length === 0) {
    return `<p class="empty">No new IPO filings tracked yet.</p>`;
  }
  return filings
    .slice(0, 3)
    .map((f) => {
      const dateLabel = new Date(`${f.filedDate}T12:00:00`).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      const title = f.ticker ? `${f.companyName} (${f.ticker})` : f.companyName;
      return `
        <div class="agenda-event-row">
          <div class="agenda-event-title">${escapeHtml(title)}</div>
          <div class="agenda-event-time">${escapeHtml(dateLabel)}</div>
        </div>`;
    })
    .join("\n");
}

function renderFinancesCard(accounts: PlaidAccount[], transactions: PlaidTransaction[]): string {
  if (accounts.length === 0) {
    return `<p class="empty">No accounts linked yet.</p>`;
  }
  const totalCash = accounts
    .filter((a) => a.type === "depository")
    .reduce((sum, a) => sum + (a.currentBalance ?? 0), 0);
  const formatted = formatMoney(totalCash, "USD");
  const plural = accounts.length === 1 ? "" : "s";

  const txRows = transactions
    .slice(0, 3)
    .map((t) => {
      // Plaid convention: positive amount = money out, negative = money in.
      const isInflow = t.amount < 0;
      const amountLabel = isInflow ? `+${formatMoney(-t.amount, t.isoCurrencyCode)}` : formatMoney(t.amount, t.isoCurrencyCode);
      return `
        <div class="agenda-event-row">
          <div class="agenda-event-title">${escapeHtml(t.merchantName ?? t.name)}</div>
          <div class="agenda-event-time" style="${isInflow ? "color: var(--accent);" : ""}">${escapeHtml(amountLabel)}</div>
        </div>`;
    })
    .join("\n");

  return `
    <p class="hint" style="margin:0 0 6px;">${escapeHtml(formatted)} total cash across ${accounts.length} account${plural}</p>
    ${txRows || `<p class="empty" style="margin:0;">No transactions yet.</p>`}`;
}

function renderMarketsCard(quotes: Quote[]): string {
  if (quotes.length === 0) {
    return `<p class="empty">No quotes yet — add tickers to your Watchlist in Settings.</p>`;
  }
  return quotes
    .map((q) => {
      const up = q.changePercent >= 0;
      const changeLabel = `${up ? "+" : ""}${q.changePercent.toFixed(2)}%`;
      return `
        <div class="agenda-event-row">
          <div class="agenda-event-title">${escapeHtml(q.symbol)}</div>
          <div class="agenda-event-time" style="${up ? "color: var(--accent);" : "color: var(--danger);"}">
            ${escapeHtml(formatMoney(q.price, "USD"))} · ${escapeHtml(changeLabel)}
          </div>
        </div>`;
    })
    .join("\n");
}

function daysAwayLabel(dateKey: string): string {
  const days = Math.round((new Date(`${dateKey}T00:00:00Z`).getTime() - new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`).getTime()) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `In ${days} days`;
}

function renderEconEventsCard(events: EconomicEvent[]): string {
  if (events.length === 0) {
    return `<p class="empty">No upcoming events seeded.</p>`;
  }
  return events
    .map((e) => {
      const dateLabel = new Date(`${e.eventDate}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
      return `
        <div class="agenda-event-row">
          <div class="agenda-event-title">${escapeHtml(e.eventName)}<span class="hint"> · ${escapeHtml(dateLabel)}</span></div>
          <div class="agenda-event-time">${escapeHtml(daysAwayLabel(e.eventDate))}</div>
        </div>`;
    })
    .join("\n");
}

// Older cached daily_context rows were stored before publishedAt existed —
// fall back to the brief's own day so the meta row never renders blank.
function formatStoryDate(story: DailyContext["stories"][number], fallbackDay: string, timezone: string): string {
  const iso = story.publishedAt ?? `${fallbackDay}T12:00:00`;
  return new Date(iso).toLocaleDateString("en-US", { timeZone: timezone, month: "short", day: "numeric" });
}

function renderNewsRow(story: DailyContext["stories"][number], fallbackDay: string, timezone: string): string {
  const paragraphs = story.summary.split("\n\n").map((p) => p.trim()).filter(Boolean);
  const firstLine = paragraphs[0] ?? "";

  // The fallback badge sits behind the img; if the image 404s or the host
  // blocks hotlinking (common with WSJ/FT), onerror hides the broken img
  // and the badge shows through instead of a blank box.
  const thumb = story.imageUrl
    ? `<div class="news-thumb-wrap">
        ${renderSourceBadge(story.source, "news-thumb-fallback")}
        <img class="news-thumb" src="${escapeHtml(story.imageUrl)}" alt="" loading="lazy" onerror="this.style.display='none'" />
      </div>`
    : `<div class="news-thumb-wrap">${renderSourceBadge(story.source, "news-thumb-fallback")}</div>`;

  const expandedParagraphs = paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join("");
  const expandedImage = story.imageUrl
    ? `<img class="news-image" src="${escapeHtml(story.imageUrl)}" alt="" loading="lazy" onerror="this.style.display='none'" />`
    : "";

  return `
    <details class="news-row selectable">
      <summary>
        ${thumb}
        <div class="news-row-main">
          <div class="news-row-meta">
            <span>${escapeHtml(story.source)}</span><span>·</span><span>${escapeHtml(formatStoryDate(story, fallbackDay, timezone))}</span>
            ${story.watchlistMatch ? `<span class="news-watchlist-badge">★ Watchlist</span>` : ""}
          </div>
          <h2 class="news-row-headline">${escapeHtml(story.headline)}</h2>
          <p class="news-row-summary">${escapeHtml(firstLine)}</p>
        </div>
      </summary>
      <div class="news-expanded">
        ${expandedImage}
        ${expandedParagraphs}
        <div class="news-callout">${escapeHtml(story.ecmTag)}</div>
        <a class="news-link" href="${escapeHtml(story.url)}" target="_blank" rel="noopener noreferrer">Read the source →</a>
      </div>
    </details>`;
}

function renderStoriesSection(context: DailyContext): string {
  if (context.stories.length === 0) {
    return `<p class="empty">No stories curated today.</p>`;
  }
  return context.stories.map((story) => renderNewsRow(story, context.day, context.timezone)).join("\n");
}

function formatNewsletterDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Strips the "<email@domain>" portion off a raw From header value like
// `Brew Markets <brewmarkets@morningbrew.com>`, leaving just the display
// name. Falls back to the raw value unchanged if there's no angle bracket.
function formatSenderName(sender: string): string {
  const angleIndex = sender.indexOf("<");
  return angleIndex === -1 ? sender : sender.slice(0, angleIndex).trim();
}

function renderNewsletterRow(n: StoredNewsletter): string {
  // The srcdoc document is served correctly as UTF-8 end-to-end (checked
  // on the wire), but some browsers don't reliably default a sandboxed
  // srcdoc document's own encoding to UTF-8 — an explicit meta tag removes
  // any ambiguity rather than relying on that inherited default.
  const srcdocContent = `<meta charset="utf-8">${n.html}`;
  return `
    <details class="newsletter">
      <summary>
        <div class="newsletter-subject">${escapeHtml(n.subject)}</div>
        <div class="newsletter-sender">${escapeHtml(formatSenderName(n.sender))} · ${escapeHtml(formatNewsletterDate(n.receivedAt))}</div>
      </summary>
      <iframe class="newsletter-frame" sandbox="allow-popups allow-same-origin" srcdoc="${escapeHtml(srcdocContent)}" loading="lazy"></iframe>
    </details>`;
}

function renderNewslettersSection(newsletters: StoredNewsletter[]): string {
  if (newsletters.length === 0) {
    return `<p class="empty">No newsletters today yet.</p>`;
  }
  return newsletters.map(renderNewsletterRow).join("\n");
}

function renderCommunityRow(item: CommunityFeedItem): string {
  return `
    <div class="news-row">
      <div class="news-row-main">
        <div class="news-row-meta">
          <span>${escapeHtml(item.source)}</span><span>·</span><span>${escapeHtml(formatRelativeTime(item.publishedAt))}</span>
        </div>
        <a class="news-row-headline" href="${escapeHtml(item.link)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.title)}</a>
      </div>
    </div>`;
}

function renderCommunitySection(items: CommunityFeedItem[]): string {
  if (items.length === 0) {
    return `<p class="empty">No community sources configured yet — add some from Settings.</p>`;
  }
  return items.map(renderCommunityRow).join("\n");
}

export interface DonnaPageData {
  context: DailyContext | null;
  newsletters: StoredNewsletter[];
  reminders: Reminder[];
  reminderNotifications: Map<string, ReminderNotification>;
  recentUploads: Upload[];
  googleConfigured: boolean;
  dashboardConfig: DashboardConfig;
  contacts: Contact[];
  classFolders: ClassFolder[];
  classLinks: Map<string, number>;
  ipoFilings: IpoFiling[];
  financeAccounts: PlaidAccount[];
  financeTransactions: PlaidTransaction[];
  todayEvents: CalendarEvent[];
  tomorrowEvents: CalendarEvent[];
  reminderGroups: ReminderGroup[];
  groupLinks: Map<string, number>;
  watchlistQuotes: Quote[];
  upcomingEconEvents: EconomicEvent[];
  communityFeedItems: CommunityFeedItem[];
}

function renderCardRow(data: DonnaPageData, timezone: string): string {
  const {
    dashboardConfig,
    reminders,
    reminderNotifications,
    recentUploads,
    googleConfigured,
    contacts,
    classFolders,
    classLinks,
    ipoFilings,
    financeAccounts,
    financeTransactions,
    todayEvents,
    tomorrowEvents,
    reminderGroups,
    groupLinks,
    watchlistQuotes,
    upcomingEconEvents,
  } = data;

  const cardsById: Record<HomeWidgetId, { icon: string; title: string; content: string }> = {
    "recent-activity": { icon: iconFolder, title: "Recent Activity", content: renderRecentActivityCard(recentUploads) },
    upcoming: { icon: iconCalendar, title: "Upcoming", content: renderCalendarCard(todayEvents, tomorrowEvents, timezone) },
    reminders: {
      icon: iconBell,
      title: "Reminders",
      content: renderRemindersCard(reminders, googleConfigured, reminderNotifications, timezone, reminderGroups, groupLinks),
    },
    contacts: { icon: iconUser, title: "Contacts", content: renderContactsCard(contacts) },
    files: { icon: iconFolder, title: "Files", content: renderFilesCard(classFolders, reminders, classLinks) },
    ipos: { icon: iconTrendingUp, title: "IPOs", content: renderIposCard(ipoFilings) },
    finances: { icon: iconWallet, title: "Finances", content: renderFinancesCard(financeAccounts, financeTransactions) },
    markets: { icon: iconMarkets, title: "Markets", content: renderMarketsCard(watchlistQuotes) },
    "econ-events": { icon: iconEconEvents, title: "Upcoming Econ Events", content: renderEconEventsCard(upcomingEconEvents) },
  };

  return dashboardConfig.homeWidgets
    .filter((w) => w.visible && cardsById[w.id])
    .map((w) => {
      const card = cardsById[w.id];
      const href = CARD_HREFS[w.id];
      return `
      <div class="card card-clickable" data-widget-id="${w.id}" onclick="navigateCard(event, '${href}')">
        <div class="card-header">
          <div class="card-icon">${card.icon}</div>
          <div class="card-title">${escapeHtml(card.title)}</div>
          <button type="button" class="card-collapse-btn" onclick="toggleCardCollapse(event, '${w.id}')" aria-label="Collapse">${iconChevronDown}</button>
        </div>
        <div class="card-content">
          ${card.content}
        </div>
      </div>`;
    })
    .join("\n");
}

export function buildDonnaHtml(data: DonnaPageData): string {
  const { context, newsletters, dashboardConfig, communityFeedItems } = data;
  const timezone = context?.timezone ?? "America/New_York";
  const dateLabel = context ? formatFullDate(context.day, timezone) : "";
  const newsDefault = dashboardConfig.defaultHomeTab !== "newsletters";

  const body = `
    <div class="section">
      <h1 class="page-title">${greetingWord(timezone)}, Nathan.</h1>
      ${dateLabel ? `<p class="page-sub">${escapeHtml(dateLabel)}</p>` : ""}
    </div>

    <div class="home-tabs">
      <button type="button" class="home-tab-btn ${newsDefault ? "home-tab-btn-active" : ""}" data-panel="news-panel" onclick="switchHomeTab(this)">News</button>
      <button type="button" class="home-tab-btn ${newsDefault ? "" : "home-tab-btn-active"}" data-panel="newsletters-panel" onclick="switchHomeTab(this)">Newsletters</button>
      <button type="button" class="home-tab-btn" data-panel="community-panel" onclick="switchHomeTab(this)">Community</button>
    </div>

    <section class="section home-tab-panel" id="news-panel" style="${newsDefault ? "" : "display:none;"}">
      ${context ? renderStoriesSection(context) : `<p class="empty">No brief has been generated yet today.</p>`}
    </section>

    <section class="section home-tab-panel" id="newsletters-panel" style="${newsDefault ? "display:none;" : ""}">
      ${renderNewslettersSection(newsletters)}
    </section>

    <section class="section home-tab-panel" id="community-panel" style="display:none;">
      ${renderCommunitySection(communityFeedItems)}
    </section>

    <div class="card-row" style="margin-top: var(--sp-3);">
      ${renderCardRow(data, timezone)}
    </div>`;

  return renderLayout({
    title: "Donna",
    activeTab: "home",
    bodyHtml: body,
    extraBodyHtml: `
  <div id="ask-popup" class="ask-popup hidden">
    <div class="ask-popup-body" id="ask-popup-body"></div>
  </div>`,
    pageScript: CLIENT_SCRIPT,
    showChatFab: true,
    navVisibility: dashboardConfig.navVisibility,
    navOrder: dashboardConfig.navOrder,
  });
}

const CLIENT_SCRIPT = `
  function navigateCard(event, href) {
    if (event.target.closest(".card-collapse-btn")) return;
    if (href) window.location.href = href;
  }

  function toggleCardCollapse(event, widgetId) {
    event.stopPropagation();
    const card = event.currentTarget.closest(".card");
    if (!card) return;
    const collapsed = card.classList.toggle("card-collapsed");
    try {
      localStorage.setItem("home-card-collapsed:" + widgetId, collapsed ? "1" : "0");
    } catch (err) {
      // Private browsing / storage disabled — collapse still works for
      // this page view, it just won't persist across reloads.
    }
  }

  document.querySelectorAll(".card[data-widget-id]").forEach((card) => {
    let collapsed = false;
    try {
      collapsed = localStorage.getItem("home-card-collapsed:" + card.dataset.widgetId) === "1";
    } catch (err) {}
    if (collapsed) card.classList.add("card-collapsed");
  });

  function switchHomeTab(btn) {
    document.querySelectorAll(".home-tab-btn").forEach((b) => b.classList.remove("home-tab-btn-active"));
    btn.classList.add("home-tab-btn-active");
    document.querySelectorAll(".home-tab-panel").forEach((p) => { p.style.display = "none"; });
    document.getElementById(btn.dataset.panel).style.display = "";
  }

  let askButton = null;

  function removeAskButton() {
    if (askButton) {
      askButton.remove();
      askButton = null;
    }
  }

  document.addEventListener("mouseup", (event) => {
    if (event.target && event.target.closest && event.target.closest(".ask-button")) {
      return;
    }
    removeAskButton();

    const selection = window.getSelection();
    const text = selection ? selection.toString().trim() : "";
    if (!text || text.length < 3 || text.length > 500) {
      return;
    }
    const anchor = selection.anchorNode;
    if (!anchor || !anchor.parentElement || !anchor.parentElement.closest(".selectable")) {
      return;
    }

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    askButton = document.createElement("button");
    askButton.className = "ask-button";
    askButton.textContent = "Ask Donna";
    askButton.style.left = Math.max(8, rect.left) + "px";
    askButton.style.top = (rect.bottom + window.scrollY + 6) + "px";
    askButton.onclick = () => askAbout(text);
    document.body.appendChild(askButton);
  });

  async function askAbout(text) {
    removeAskButton();
    const popup = document.getElementById("ask-popup");
    const body = document.getElementById("ask-popup-body");
    popup.classList.remove("hidden");
    popup.style.left = "16px";
    popup.style.bottom = "16px";
    popup.style.top = "auto";
    body.textContent = "Thinking…";

    try {
      const res = await fetch("/api/donna", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      body.textContent = data.explanation || "Not sure how to explain that one.";
    } catch (err) {
      body.textContent = "Couldn't reach Donna just now.";
    }
  }

  document.addEventListener("click", (event) => {
    const popup = document.getElementById("ask-popup");
    if (!popup.classList.contains("hidden") && !popup.contains(event.target) && !(event.target.closest && event.target.closest(".ask-button"))) {
      popup.classList.add("hidden");
    }
  });
`;
