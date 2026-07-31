import type { DailyContext } from "../chat/dailyContext.js";
import type { StoredNewsletter } from "../gmail/store.js";
import type { Reminder } from "../google/tasks.js";
import type { Upload } from "../storage/uploads.js";
import { escapeHtml } from "../util/html.js";
import { renderLayout } from "./layout.js";
import { iconBell, iconCalendar, iconFolder } from "./icons.js";

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

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMinutes = Math.round(diffMs / 60000);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (Math.abs(diffMinutes) < 60) return rtf.format(-diffMinutes, "minute");
  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) return rtf.format(-diffHours, "hour");
  const diffDays = Math.round(diffHours / 24);
  return rtf.format(-diffDays, "day");
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

function renderRemindersCard(reminders: Reminder[], googleConfigured: boolean): string {
  if (!googleConfigured) {
    return `<p class="empty">Not connected yet — finish Google setup to use reminders.</p>`;
  }
  if (reminders.length === 0) {
    return `<p class="empty">No reminders.</p>`;
  }
  return reminders
    .slice(0, 4)
    .map((r) => `<div class="agenda-event-row"><div class="agenda-event-title">${escapeHtml(r.title)}</div></div>`)
    .join("\n");
}

function renderNewsRow(story: DailyContext["stories"][number]): string {
  const paragraphs = story.summary.split("\n\n").map((p) => p.trim()).filter(Boolean);
  const firstLine = paragraphs[0] ?? "";

  const thumb = story.imageUrl
    ? `<img class="news-thumb" src="${escapeHtml(story.imageUrl)}" alt="" loading="lazy" />`
    : `<div class="news-thumb"></div>`;

  const expandedParagraphs = paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join("");
  const expandedImage = story.imageUrl
    ? `<img class="news-image" src="${escapeHtml(story.imageUrl)}" alt="" loading="lazy" />`
    : "";

  return `
    <details class="news-row selectable">
      <summary>
        ${thumb}
        <div class="news-row-main">
          <div class="news-row-meta"><span>${escapeHtml(story.category)}</span><span>·</span><span>${escapeHtml(story.source)}</span></div>
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
  return context.stories.map(renderNewsRow).join("\n");
}

function renderNewslettersSection(newsletters: StoredNewsletter[]): string {
  if (newsletters.length === 0) {
    return "";
  }

  const cards = newsletters
    .map(
      (n) => `
        <article class="newsletter">
          <div class="newsletter-meta">
            <span class="newsletter-subject">${escapeHtml(n.subject)}</span>
            <span class="newsletter-sender">${escapeHtml(n.sender)}</span>
          </div>
          <iframe class="newsletter-frame" sandbox="allow-popups" srcdoc="${escapeHtml(n.html)}"></iframe>
        </article>`
    )
    .join("\n");

  return `
    <section class="section">
      <h1 class="section-title">Newsletters</h1>
      ${cards}
    </section>`;
}

export interface DonnaPageData {
  context: DailyContext | null;
  newsletters: StoredNewsletter[];
  reminders: Reminder[];
  recentUploads: Upload[];
  googleConfigured: boolean;
}

export function buildDonnaHtml(data: DonnaPageData): string {
  const { context, newsletters, reminders, recentUploads, googleConfigured } = data;
  const timezone = context?.timezone ?? "America/New_York";
  const dateLabel = context ? formatFullDate(context.day, timezone) : "";

  const body = `
    <div class="section">
      <h1 class="page-title">${greetingWord(timezone)}, Nathan.</h1>
      ${dateLabel ? `<p class="page-sub">${escapeHtml(dateLabel)}</p>` : ""}
    </div>

    <div class="card-row">
      <div class="card">
        <div class="card-icon">${iconFolder}</div>
        <div class="card-title">Recent Activity</div>
        ${renderRecentActivityCard(recentUploads)}
      </div>
      <div class="card">
        <div class="card-icon">${iconCalendar}</div>
        <div class="card-title">Upcoming</div>
        ${renderCalendarCard(context)}
      </div>
      <div class="card">
        <div class="card-icon">${iconBell}</div>
        <div class="card-title">Reminders</div>
        ${renderRemindersCard(reminders, googleConfigured)}
      </div>
    </div>

    ${
      context
        ? `<section class="section">
      <h1 class="section-title">News</h1>
      ${renderStoriesSection(context)}
    </section>

    ${renderNewslettersSection(newsletters)}`
        : `<section class="section"><p class="empty">No brief has been generated yet today.</p></section>`
    }`;

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
  });
}

const CLIENT_SCRIPT = `
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
