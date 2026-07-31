import type { DailyContext } from "../chat/dailyContext.js";
import type { StoredNewsletter } from "../gmail/store.js";
import { escapeHtml } from "../util/html.js";

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

function renderRemindersSection(context: DailyContext): string {
  if (context.reminders.length === 0) {
    return `<p class="empty">No reminders.</p>`;
  }
  return `<ul class="reminders">${context.reminders
    .map((r) => `<li>${escapeHtml(r)}</li>`)
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

export function buildDonnaHtml(context: DailyContext | null, newsletters: StoredNewsletter[]): string {
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
        ${renderRemindersSection(context)}
      </section>`
    : `<section class="section"><p class="empty">No brief has been generated yet today.</p></section>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Donna</title>
<style>
${STYLES}
</style>
</head>
<body>
  <header class="masthead">
    <div class="masthead-inner">
      <div class="wordmark">Donna</div>
      <div class="date">${escapeHtml(dateLabel)}</div>
    </div>
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

const STYLES = `
  :root {
    color-scheme: light;
    --ink: #1a1a1a;
    --paper: #fdfcf9;
    --rule: #ddd8cc;
    --accent-ecm: #8c3a2b;
    --accent-markets: #1f4e5f;
    --muted: #6b6558;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: var(--paper);
    color: var(--ink);
    font-family: -apple-system, "Segoe UI", Helvetica, Arial, sans-serif;
    line-height: 1.5;
  }
  .masthead {
    border-bottom: 3px solid var(--ink);
    padding: 20px 16px 14px;
  }
  .masthead-inner {
    max-width: 720px;
    margin: 0 auto;
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }
  .wordmark {
    font-family: Georgia, "Times New Roman", serif;
    font-weight: 700;
    font-size: 32px;
    letter-spacing: 0.5px;
  }
  .date {
    color: var(--muted);
    font-size: 14px;
  }
  .content {
    max-width: 720px;
    margin: 0 auto;
    padding: 24px 16px 80px;
  }
  .section { margin-bottom: 40px; }
  .section-title {
    font-family: Georgia, "Times New Roman", serif;
    font-size: 20px;
    border-bottom: 1px solid var(--rule);
    padding-bottom: 8px;
    margin-bottom: 20px;
  }
  .empty { color: var(--muted); font-style: italic; }

  .story {
    border-bottom: 1px solid var(--rule);
    padding-bottom: 24px;
    margin-bottom: 24px;
  }
  .story:last-child { border-bottom: none; }
  .story-image {
    width: 100%;
    max-height: 320px;
    object-fit: cover;
    border-radius: 4px;
    margin-bottom: 14px;
  }
  .story-meta {
    display: flex;
    gap: 10px;
    align-items: center;
    margin-bottom: 8px;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .category {
    padding: 2px 8px;
    border-radius: 3px;
    color: #fff;
    font-weight: 600;
  }
  .cat-ecm { background: var(--accent-ecm); }
  .cat-markets { background: var(--accent-markets); }
  .source { color: var(--muted); }
  .story-headline {
    font-family: Georgia, "Times New Roman", serif;
    font-size: 24px;
    line-height: 1.25;
    margin: 0 0 12px;
  }
  .story-body p {
    margin: 0 0 12px;
    font-size: 16px;
  }
  .ecm-tag {
    background: #f2ede0;
    border-left: 3px solid var(--accent-ecm);
    padding: 10px 14px;
    font-size: 14px;
    margin: 14px 0;
  }
  .story-link {
    font-size: 14px;
    color: var(--accent-markets);
    text-decoration: none;
  }
  .story-link:hover { text-decoration: underline; }

  .newsletter {
    border: 1px solid var(--rule);
    border-radius: 6px;
    padding: 14px;
    margin-bottom: 16px;
  }
  .newsletter-meta {
    display: flex;
    justify-content: space-between;
    font-size: 13px;
    color: var(--muted);
    margin-bottom: 10px;
  }
  .newsletter-subject { font-weight: 600; color: var(--ink); }
  .newsletter-frame {
    width: 100%;
    height: 500px;
    border: none;
  }

  .event {
    display: flex;
    gap: 16px;
    padding: 10px 0;
    border-bottom: 1px solid var(--rule);
  }
  .event:last-child { border-bottom: none; }
  .event-time {
    flex: 0 0 130px;
    font-weight: 600;
    font-size: 14px;
  }
  .event-title { font-size: 15px; }
  .event-detail { font-size: 13px; color: var(--muted); }

  .reminders {
    margin: 0;
    padding-left: 20px;
  }
  .reminders li { margin-bottom: 6px; }

  .ask-popup {
    position: fixed;
    max-width: 320px;
    background: var(--ink);
    color: var(--paper);
    padding: 12px 14px;
    border-radius: 8px;
    font-size: 14px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.25);
    z-index: 1000;
  }
  .ask-popup.hidden { display: none; }
  .ask-button {
    position: fixed;
    background: var(--accent-markets);
    color: #fff;
    border: none;
    border-radius: 6px;
    padding: 6px 12px;
    font-size: 13px;
    cursor: pointer;
    z-index: 1000;
  }
`;

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
