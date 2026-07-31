import type { DailyContext } from "../chat/dailyContext.js";
import type { StoredNewsletter } from "../gmail/store.js";
import type { Reminder } from "../google/tasks.js";
import type { Upload } from "../storage/uploads.js";
import { escapeHtml } from "../util/html.js";
import { renderLayout } from "./layout.js";

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

function renderCalendarSection(context: DailyContext): string {
  if (context.calendarEvents.length === 0) {
    return `<p class="empty">Nothing on the calendar today.</p>`;
  }

  return context.calendarEvents
    .map((e) => {
      const timeLabel = e.end
        ? `${formatEventTime(e.start, context.timezone)} – ${formatEventTime(e.end, context.timezone)}`
        : formatEventTime(e.start, context.timezone);

      const details = [
        e.location ? `<div class="event-detail">${escapeHtml(e.location)}</div>` : "",
        e.description ? `<div class="event-detail">${escapeHtml(e.description)}</div>` : "",
      ].join("");

      return `
        <div class="event">
          <div class="event-time">${escapeHtml(timeLabel)}</div>
          <div class="event-body">
            <div class="event-title">${escapeHtml(e.summary)}</div>
            ${details}
          </div>
        </div>`;
    })
    .join("\n");
}

function uploadLabel(u: Upload): string {
  const kindLabel = u.kind === "lecture" ? "Transcript" : "Scan";
  return `${kindLabel}: ${u.originalFilename}`;
}

function renderRecentActivitySection(uploads: Upload[]): string {
  if (uploads.length === 0) {
    return `<p class="empty">No recent activity.</p>`;
  }

  return uploads
    .map(
      (u) => `
        <div class="recent-item">
          <div>${escapeHtml(uploadLabel(u))}</div>
          <div class="recent-item-time">${escapeHtml(formatRelativeTime(u.createdAt))}</div>
        </div>`
    )
    .join("\n");
}

function renderRemindersSection(reminders: Reminder[], googleConfigured: boolean): string {
  if (!googleConfigured) {
    return `<p class="empty">Not connected yet — finish Google setup to use reminders.</p>`;
  }
  if (reminders.length === 0) {
    return `<p class="empty">No reminders.</p>`;
  }
  return `<ul class="reminders">${reminders
    .map((r) => `<li>${escapeHtml(r.title)}</li>`)
    .join("")}</ul>`;
}

function renderStoriesSection(context: DailyContext): string {
  if (context.stories.length === 0) {
    return `<p class="empty">No stories curated today.</p>`;
  }

  return context.stories
    .map((story) => {
      const summaryParagraphs = story.summary
        .split("\n\n")
        .map((p) => `<p>${escapeHtml(p)}</p>`)
        .join("");

      const image = story.imageUrl
        ? `<img class="story-image" src="${escapeHtml(story.imageUrl)}" alt="" loading="lazy" />`
        : "";

      const categoryClass = story.category === "Markets" ? "cat-markets" : "cat-ecm";

      return `
        <article class="story">
          ${image}
          <div class="story-body selectable">
            <div class="story-meta">
              <span class="category ${categoryClass}">${escapeHtml(story.category)}</span>
              <span class="source">${escapeHtml(story.source)}</span>
            </div>
            <h2 class="story-headline">${escapeHtml(story.headline)}</h2>
            ${summaryParagraphs}
            <div class="ecm-tag">${escapeHtml(story.ecmTag)}</div>
            <a class="story-link" href="${escapeHtml(story.url)}" target="_blank" rel="noopener noreferrer">Read the source →</a>
          </div>
        </article>`;
    })
    .join("\n");
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
  const dateLabel = context ? formatFullDate(context.day, context.timezone) : "";

  const body = context
    ? `
      <section class="section">
        <h1 class="section-title">News</h1>
        <div class="stories">
          ${renderStoriesSection(context)}
        </div>
      </section>

      ${renderNewslettersSection(newsletters)}

      <section class="section">
        <h1 class="section-title">Upcoming &amp; Recent</h1>
        <div class="brief-columns">
          <div class="brief-col">
            <h2>Upcoming</h2>
            <div class="events">
              ${renderCalendarSection(context)}
            </div>
          </div>
          <div class="brief-col">
            <h2>Recent Activity</h2>
            ${renderRecentActivitySection(recentUploads)}
          </div>
        </div>
      </section>

      <section class="section">
        <h1 class="section-title">Reminders</h1>
        ${renderRemindersSection(reminders, googleConfigured)}
      </section>`
    : `<section class="section"><p class="empty">No brief has been generated yet today.</p></section>`;

  return renderLayout({
    title: "Donna",
    activeTab: "brief",
    dateLabel,
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
      const res = await fetch("/api/donna-ask", {
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
