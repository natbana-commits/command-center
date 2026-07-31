import type { DailyContext } from "../chat/dailyContext.js";
import type { StoredNewsletter } from "../gmail/store.js";
import type { Reminder } from "../google/tasks.js";
import { escapeHtml } from "../util/html.js";
import { BASE_STYLES } from "./styles.js";
import { renderNav, PWA_HEAD } from "./nav.js";

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
  googleConfigured: boolean;
}

export function buildDonnaHtml(data: DonnaPageData): string {
  const { context, newsletters, reminders, googleConfigured } = data;
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
        <h1 class="section-title">Calendar</h1>
        <div class="events">
          ${renderCalendarSection(context)}
        </div>
      </section>

      <section class="section">
        <h1 class="section-title">Reminders</h1>
        ${renderRemindersSection(reminders, googleConfigured)}
      </section>`
    : `<section class="section"><p class="empty">No brief has been generated yet today.</p></section>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Donna</title>
${PWA_HEAD}
<style>
${BASE_STYLES}
</style>
</head>
<body>
  <header class="masthead">
    <div class="masthead-inner">
      <div class="wordmark">Donna</div>
      <div class="date">${escapeHtml(dateLabel)}</div>
    </div>
    <nav class="tab-bar">${renderNav("brief")}</nav>
  </header>

  <main class="content">
    ${body}
  </main>

  <div id="ask-popup" class="ask-popup hidden">
    <div class="ask-popup-body" id="ask-popup-body"></div>
  </div>

  <script>
${CLIENT_SCRIPT}
  </script>
</body>
</html>`;
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
