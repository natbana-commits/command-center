import type { DailyContext } from "../chat/dailyContext.js";
import type { DashboardConfig, HomeWidgetId } from "../config.js";
import type { Contact } from "../contacts/store.js";
import type { ClassFolder } from "../drive/classFolders.js";
import type { StoredNewsletter } from "../gmail/store.js";
import type { Reminder } from "../google/tasks.js";
import type { ReminderNotification } from "../reminders/notifications.js";
import type { Upload } from "../storage/uploads.js";
import { escapeHtml } from "../util/html.js";
import { formatRelativeTime, withTimeSuffix } from "../util/time.js";
import { renderLayout } from "./layout.js";
import { iconBell, iconCalendar, iconFolder, iconUser } from "./icons.js";
import { renderSourceBadge } from "./sourceBadge.js";
import { effectiveDue, formatDue } from "./remindersPage.js";

function formatEventTime(iso: string, timezone: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
  });
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

function renderCalendarCard(context: DailyContext | null): string {
  if (!context || context.calendarEvents.length === 0) {
    return `<p class="empty">Nothing on the calendar today.</p>`;
  }
  return context.calendarEvents
    .slice(0, 4)
    .map((e) => {
      const timeLabel = e.end
        ? `${formatEventTime(e.start, context.timezone)} – ${formatEventTime(e.end, context.timezone)}`
        : formatEventTime(e.start, context.timezone);
      return `
        <div class="agenda-event-row">
          <div class="agenda-event-time">${escapeHtml(timeLabel)}</div>
          <div class="agenda-event-title">${escapeHtml(e.summary)}</div>
        </div>`;
    })
    .join("\n");
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
  timezone: string
): string {
  if (!googleConfigured) {
    return `<p class="empty">Not connected yet — finish Google setup to use reminders.</p>`;
  }
  if (reminders.length === 0) {
    return `<p class="empty">No reminders.</p>`;
  }
  return reminders
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
      return `
        <div class="reminder-row ${rowClass}">
          <div class="reminder-body">
            <span class="reminder-title">${escapeHtml(withTimeSuffix(r.title, null))}</span>
            ${dueBadge}
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
}

function renderCardRow(data: DonnaPageData, timezone: string): string {
  const {
    dashboardConfig,
    context,
    reminders,
    reminderNotifications,
    recentUploads,
    googleConfigured,
    contacts,
    classFolders,
    classLinks,
  } = data;

  const cardsById: Record<HomeWidgetId, { icon: string; title: string; content: string }> = {
    "recent-activity": { icon: iconFolder, title: "Recent Activity", content: renderRecentActivityCard(recentUploads) },
    upcoming: { icon: iconCalendar, title: "Upcoming", content: renderCalendarCard(context) },
    reminders: {
      icon: iconBell,
      title: "Reminders",
      content: renderRemindersCard(reminders, googleConfigured, reminderNotifications, timezone),
    },
    contacts: { icon: iconUser, title: "Contacts", content: renderContactsCard(contacts) },
    files: { icon: iconFolder, title: "Files", content: renderFilesCard(classFolders, reminders, classLinks) },
  };

  return dashboardConfig.homeWidgets
    .filter((w) => w.visible && cardsById[w.id])
    .map((w) => {
      const card = cardsById[w.id];
      return `
      <div class="card">
        <div class="card-icon">${card.icon}</div>
        <div class="card-title">${escapeHtml(card.title)}</div>
        ${card.content}
      </div>`;
    })
    .join("\n");
}

export function buildDonnaHtml(data: DonnaPageData): string {
  const { context, newsletters, dashboardConfig } = data;
  const timezone = context?.timezone ?? "America/New_York";
  const dateLabel = context ? formatFullDate(context.day, timezone) : "";
  const newsDefault = dashboardConfig.defaultHomeTab !== "newsletters";

  const body = `
    <div class="section">
      <h1 class="page-title">${greetingWord(timezone)}, Nathan.</h1>
      ${dateLabel ? `<p class="page-sub">${escapeHtml(dateLabel)}</p>` : ""}
    </div>

    <div class="card-row">
      ${renderCardRow(data, timezone)}
    </div>

    <div class="home-tabs">
      <button type="button" class="home-tab-btn ${newsDefault ? "home-tab-btn-active" : ""}" data-panel="news-panel" onclick="switchHomeTab(this)">News</button>
      <button type="button" class="home-tab-btn ${newsDefault ? "" : "home-tab-btn-active"}" data-panel="newsletters-panel" onclick="switchHomeTab(this)">Newsletters</button>
    </div>

    <section class="section home-tab-panel" id="news-panel" style="${newsDefault ? "" : "display:none;"}">
      ${context ? renderStoriesSection(context) : `<p class="empty">No brief has been generated yet today.</p>`}
    </section>

    <section class="section home-tab-panel" id="newsletters-panel" style="${newsDefault ? "display:none;" : ""}">
      ${renderNewslettersSection(newsletters)}
    </section>`;

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
