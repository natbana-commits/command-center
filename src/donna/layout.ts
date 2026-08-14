import { NAV_TAB_IDS, type NavVisibility } from "../config.js";
import { escapeHtml } from "../util/html.js";
import { PWA_HEAD, renderSidebarNav, renderMobileNav, type Tab } from "./nav.js";
import { iconSettings, iconChat } from "./icons.js";

// Derived from NAV_TAB_IDS rather than listed by hand — the same
// self-heal reasoning as config.ts's loadSettings() applies here too:
// adding a tab shouldn't require remembering this fallback exists.
const ALL_NAV_VISIBLE: NavVisibility = Object.fromEntries(NAV_TAB_IDS.map((id) => [id, true])) as NavVisibility;
const DEFAULT_NAV_ORDER: string[] = [...NAV_TAB_IDS];

// The shared CSS (donna.css) and the page-invariant client scripts
// (donna.js: progress bar, command palette, client-side router) used to be
// re-embedded inline in every single page response — including every
// client-side nav fetch and hover-prefetch, since those fetch the full
// HTML document. Serving them as static files lets the browser cache them
// once instead of re-downloading ~82KB on every navigation. Bump this
// whenever donna.css/donna.js's content changes, so browsers holding a
// long-cached copy pick up the new one instead of serving stale CSS/JS
// against updated markup.
const ASSET_VERSION = "1";

export interface LayoutOptions {
  title: string;
  activeTab: Tab;
  bodyHtml: string;
  extraBodyHtml?: string;
  pageScript?: string;
  showChatFab?: boolean;
  navVisibility?: NavVisibility;
  navOrder?: string[];
}

// Runs synchronously in <head>, before <style> is parsed, so an explicit
// saved preference applies before first paint (no flash of the wrong
// theme). Absent a saved preference, the CSS media query alone decides
// based on the OS setting — nothing to do here in that case.
const THEME_INIT_SCRIPT = `
(function () {
  try {
    const saved = localStorage.getItem("donna-theme");
    if (saved === "light" || saved === "dark") {
      document.documentElement.setAttribute("data-theme", saved);
    }
  } catch (e) {}
})();
`;

function renderCommandPaletteMarkup(): string {
  return `
  <div class="modal-scrim" id="palette-scrim">
    <div class="modal-panel palette-panel" id="palette-panel" onclick="event.stopPropagation()">
      <input type="text" id="palette-input" class="palette-input" placeholder="Search or type a command…" autocomplete="off" />
      <div id="palette-results" class="palette-results"></div>
    </div>
  </div>`;
}

// The desktop trigger lives in the sidebar's icon cluster next to Settings
// (see the sidebar-user markup below); this docked mobile bar is its
// mobile equivalent, since there's no sidebar there. Both share the
// .chat-trigger class and open the same overlay panel below.
function renderChatFabMarkup(): string {
  return `
  <div class="chat-mobile-bar chat-trigger" role="button" tabindex="0" aria-label="Ask Donna">
    ${iconChat}
    <span>Ask Donna anything…</span>
  </div>
  <div class="chat-scrim" id="chat-scrim"></div>
  <div class="chat-overlay-panel" id="chat-overlay-panel">
    <div class="chat-overlay-header">
      <span>Donna Chat</span>
      <button class="chat-overlay-close" id="chat-overlay-close" aria-label="Close">&#x2715;</button>
    </div>
    <div class="chat-overlay-body" id="chat-overlay-body"></div>
    <div class="chat-overlay-footer">
      <input type="text" id="chat-overlay-input" placeholder="Ask Donna…" autocomplete="off" />
      <button id="chat-overlay-send" aria-label="Send">&#x27A4;</button>
    </div>
  </div>`;
}

const CHAT_FAB_SCRIPT = `
(function () {
  // Two triggers share this one overlay: the sidebar icon (desktop) and
  // the docked bar (mobile, where there's no sidebar to put an icon in).
  const triggers = document.querySelectorAll(".chat-trigger");
  const scrim = document.getElementById("chat-scrim");
  const panel = document.getElementById("chat-overlay-panel");
  const closeBtn = document.getElementById("chat-overlay-close");
  const body = document.getElementById("chat-overlay-body");
  const input = document.getElementById("chat-overlay-input");
  const sendBtn = document.getElementById("chat-overlay-send");
  if (triggers.length === 0) return;
  let loaded = false;

  function appendBubble(role, text) {
    const div = document.createElement("div");
    div.className = "chat-bubble " + (role === "user" ? "chat-bubble-user" : "chat-bubble-assistant");
    div.textContent = text;
    body.appendChild(div);
    div.scrollIntoView({ behavior: "smooth", block: "end" });
  }

  async function loadHistory() {
    body.innerHTML = "";
    try {
      const res = await fetch("/api/donna-chat");
      const data = await res.json();
      const messages = data.messages || [];
      if (messages.length === 0) {
        const p = document.createElement("p");
        p.className = "empty";
        p.textContent = "Ask Donna anything.";
        body.appendChild(p);
      } else {
        messages.forEach((m) => appendBubble(m.role, m.content));
      }
    } catch (err) {
      body.innerHTML = "<p class=\\"empty\\">Couldn't load chat history.</p>";
    }
  }

  function open() {
    scrim.classList.add("open");
    panel.classList.add("open");
    if (!loaded) {
      loaded = true;
      loadHistory();
    }
  }

  function close() {
    scrim.classList.remove("open");
    panel.classList.remove("open");
  }

  async function send() {
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    sendBtn.disabled = true;
    appendBubble("user", text);
    const thinking = document.createElement("div");
    thinking.className = "chat-bubble chat-bubble-assistant";
    thinking.textContent = "Thinking…";
    body.appendChild(thinking);
    thinking.scrollIntoView({ behavior: "smooth", block: "end" });

    try {
      const res = await fetch("/api/donna-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      thinking.textContent = data.reply || "Not sure how to answer that one.";
    } catch (err) {
      thinking.textContent = "Couldn't reach Donna just now.";
    } finally {
      sendBtn.disabled = false;
    }
  }

  triggers.forEach((el) => {
    el.addEventListener("click", open);
    // Only the mobile bar needs this — a real <button> (the sidebar
    // trigger) already gets Enter/Space activation natively, and this
    // guard stops it from double-firing open() there.
    el.addEventListener("keydown", (e) => {
      if (e.target === el && el.tagName !== "BUTTON" && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        open();
      }
    });
  });
  closeBtn.addEventListener("click", close);
  scrim.addEventListener("click", close);
  sendBtn.addEventListener("click", send);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") send(); });
})();
`;

export function renderLayout(opts: LayoutOptions): string {
  const {
    title,
    activeTab,
    bodyHtml,
    extraBodyHtml = "",
    pageScript = "",
    showChatFab = false,
    navVisibility = ALL_NAV_VISIBLE,
    navOrder = DEFAULT_NAV_ORDER,
  } = opts;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
${PWA_HEAD}
<script>${THEME_INIT_SCRIPT}</script>
<link rel="stylesheet" href="/donna.css?v=${ASSET_VERSION}" />
</head>
<body>
  <div class="nav-progress-bar" id="nav-progress-bar"></div>
  <div class="app-shell">
    <aside class="sidebar">
      <div class="sidebar-logo">
        <div class="sidebar-logo-mark">D</div>
        <div class="sidebar-logo-word">Donna</div>
      </div>
      <button type="button" class="palette-trigger-btn" onclick="window.__paletteOpen && window.__paletteOpen()">
        <span>Search…</span><span class="palette-trigger-kbd">&#x2318;K</span>
      </button>
      <nav class="sidebar-nav" id="sidebar-nav-region">${renderSidebarNav(activeTab, navVisibility, navOrder)}</nav>
      <div class="sidebar-user">
        <button type="button" class="sidebar-user-icon-link chat-trigger" title="Ask Donna" aria-label="Ask Donna">${iconChat}</button>
        <a class="sidebar-user-icon-link${activeTab === "settings" ? " sidebar-user-icon-link-active" : ""}" href="/donna/settings" title="Settings" aria-label="Settings">${iconSettings}</a>
      </div>
    </aside>

    <main class="main-content">
      <nav class="mobile-tab-strip" id="mobile-nav-region">${renderMobileNav(activeTab, navVisibility, navOrder)}</nav>
      <div id="page-content">
        ${bodyHtml}
        ${extraBodyHtml}
        <script>${pageScript}</script>
      </div>
    </main>
  </div>

  ${renderCommandPaletteMarkup()}
  ${showChatFab ? renderChatFabMarkup() : ""}

  <script src="/donna.js?v=${ASSET_VERSION}"></script>
  ${showChatFab ? `<script>${CHAT_FAB_SCRIPT}</script>` : ""}
</body>
</html>`;
}
