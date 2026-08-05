import type { DailyContext } from "../chat/dailyContext.js";
import type { NavVisibility } from "../config.js";
import type { StoredNewsletter } from "../gmail/store.js";
import type { CommunityFeedItem } from "../news/communityFeeds.js";
import { escapeHtml } from "../util/html.js";
import { formatRelativeTime } from "../util/time.js";
import { renderLayout } from "./layout.js";
import { renderSourceBadge } from "./sourceBadge.js";
import { renderPageEditLink } from "./editLink.js";

// Older cached daily_context rows were stored before publishedAt existed —
// fall back to the brief's own day so the meta row never renders blank.
function formatStoryDate(story: DailyContext["stories"][number], fallbackDay: string, timezone: string): string {
  const iso = story.publishedAt ?? `${fallbackDay}T12:00:00`;
  return new Date(iso).toLocaleDateString("en-US", { timeZone: timezone, month: "short", day: "numeric" });
}

// Stable per-story id for deep-linking from the Home News widget — stories
// have no numeric id (they're not a persisted row with one, just an array
// inside daily_context), so the URL (always unique per story) stands in.
export function storyAnchorId(url: string): string {
  return `story-${encodeURIComponent(url).replace(/%/g, "_")}`;
}

function renderNewsRow(story: DailyContext["stories"][number], fallbackDay: string, timezone: string, openByDefault: boolean): string {
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
    <details class="news-row selectable" id="${storyAnchorId(story.url)}"${openByDefault ? " open" : ""}>
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

function renderStoriesSection(context: DailyContext, highlightUrl: string | null): string {
  if (context.stories.length === 0) {
    return `<p class="empty">No stories curated today.</p>`;
  }
  return context.stories
    .map((story) => renderNewsRow(story, context.day, context.timezone, Boolean(highlightUrl) && story.url === highlightUrl))
    .join("\n");
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

function renderNewsletterRow(n: StoredNewsletter, openByDefault: boolean): string {
  // The srcdoc document is served correctly as UTF-8 end-to-end (checked
  // on the wire), but some browsers don't reliably default a sandboxed
  // srcdoc document's own encoding to UTF-8 — an explicit meta tag removes
  // any ambiguity rather than relying on that inherited default.
  // The CSP's font-src ('self' data:) blocks whatever webfonts a
  // newsletter's own HTML tries to pull in (Axios and others ship
  // @font-face rules pointing at their CDN) — rather than loosening that
  // policy for untrusted third-party email HTML, force system fonts
  // inside the sandboxed doc so text still renders cleanly instead of
  // silently falling back to whatever the browser's own default is.
  const srcdocContent = `<meta charset="utf-8"><style>*,*::before,*::after{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif!important;}</style>${n.html}`;
  return `
    <details class="newsletter" id="newsletter-${escapeHtml(n.id)}"${openByDefault ? " open" : ""}>
      <summary>
        <div class="newsletter-subject">${escapeHtml(n.subject)}</div>
        <div class="newsletter-sender">${escapeHtml(formatSenderName(n.sender))} · ${escapeHtml(formatNewsletterDate(n.receivedAt))}</div>
      </summary>
      <iframe class="newsletter-frame" sandbox="allow-popups allow-same-origin" srcdoc="${escapeHtml(srcdocContent)}" loading="lazy"></iframe>
    </details>`;
}

function renderNewslettersSection(newsletters: StoredNewsletter[], highlightId: string | null): string {
  if (newsletters.length === 0) {
    return `<p class="empty">No newsletters today yet.</p>`;
  }
  return newsletters.map((n) => renderNewsletterRow(n, n.id === highlightId)).join("\n");
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

export interface NewsPageData {
  context: DailyContext | null;
  newsletters: StoredNewsletter[];
  communityFeedItems: CommunityFeedItem[];
  defaultNewsTab: "news" | "newsletters";
  // From the Home News widget's ?highlight= link — either a story URL or a
  // "newsletter:<id>" tag, opening + scrolling to that item on load.
  highlight: string | null;
  navVisibility: NavVisibility;
  navOrder: string[];
}

export function buildNewsHtml(data: NewsPageData): string {
  const { context, newsletters, communityFeedItems, defaultNewsTab, highlight, navVisibility, navOrder } = data;

  const highlightNewsletterId = highlight?.startsWith("newsletter:") ? highlight.slice("newsletter:".length) : null;
  const highlightStoryUrl = highlight && !highlightNewsletterId ? highlight : null;

  // A highlight link always wins over the stored default tab — landing on
  // the News tab from the newsletter widget link should open Newsletters,
  // not whatever tab happened to be configured as default.
  const newsDefault = highlightNewsletterId ? false : highlightStoryUrl ? true : defaultNewsTab !== "newsletters";

  const body = `
    <div class="section">
      <h1 class="page-title">News</h1>
    </div>

    <div class="home-tabs">
      <button type="button" class="home-tab-btn ${newsDefault ? "home-tab-btn-active" : ""}" data-panel="news-panel" onclick="switchHomeTab(this)">News</button>
      <button type="button" class="home-tab-btn ${newsDefault ? "" : "home-tab-btn-active"}" data-panel="newsletters-panel" onclick="switchHomeTab(this)">Newsletters</button>
      <button type="button" class="home-tab-btn" data-panel="community-panel" onclick="switchHomeTab(this)">Community</button>
    </div>

    <section class="section home-tab-panel" id="news-panel" style="${newsDefault ? "" : "display:none;"}">
      ${context ? renderStoriesSection(context, highlightStoryUrl) : `<p class="empty">No brief has been generated yet today.</p>`}
    </section>

    <section class="section home-tab-panel" id="newsletters-panel" style="${newsDefault ? "display:none;" : ""}">
      ${renderNewslettersSection(newsletters, highlightNewsletterId)}
    </section>

    <section class="section home-tab-panel" id="community-panel" style="display:none;">
      <div style="display:flex; justify-content:flex-end; align-items:center; gap: var(--sp-2); margin-bottom: var(--sp-2);">
        ${renderPageEditLink("settings-community-feeds", "Sources")}
        <a class="hint" href="/donna/news?refresh=1" title="Re-check community sources for anything posted since the last load">Refresh</a>
      </div>
      ${renderCommunitySection(communityFeedItems)}
    </section>`;

  const highlightAnchorId = highlightNewsletterId ? `newsletter-${highlightNewsletterId}` : highlightStoryUrl ? storyAnchorId(highlightStoryUrl) : null;

  return renderLayout({
    title: "Donna · News",
    activeTab: "news",
    bodyHtml: body,
    extraBodyHtml: `
  <div id="ask-popup" class="ask-popup hidden">
    <div class="ask-popup-body" id="ask-popup-body"></div>
  </div>`,
    pageScript: `${CLIENT_SCRIPT}${highlightAnchorId ? `\ndocument.getElementById(${JSON.stringify(highlightAnchorId)})?.scrollIntoView({ block: "start" });` : ""}`,
    showChatFab: true,
    navVisibility,
    navOrder,
  });
}

// The "Ask Donna" text-selection popup only makes sense against long-form
// content (news stories), which is why it lives here rather than on Home
// now that Home is just number/row widgets.
const CLIENT_SCRIPT = `
(function () {
  function switchHomeTab(btn) {
    document.querySelectorAll(".home-tab-btn").forEach((b) => b.classList.remove("home-tab-btn-active"));
    btn.classList.add("home-tab-btn-active");
    document.querySelectorAll(".home-tab-panel").forEach((p) => { p.style.display = "none"; });
    document.getElementById(btn.dataset.panel).style.display = "";
  }
  window.switchHomeTab = switchHomeTab;

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
})();
`;
