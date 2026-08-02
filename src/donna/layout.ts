import { NAV_TAB_IDS, type NavVisibility } from "../config.js";
import { escapeHtml } from "../util/html.js";
import { BASE_STYLES } from "./styles.js";
import { PWA_HEAD, renderSidebarNav, renderBottomNav, type Tab } from "./nav.js";

// Derived from NAV_TAB_IDS rather than listed by hand — the same
// self-heal reasoning as config.ts's loadSettings() applies here too:
// adding a tab shouldn't require remembering this fallback exists.
const ALL_NAV_VISIBLE: NavVisibility = Object.fromEntries(NAV_TAB_IDS.map((id) => [id, true])) as NavVisibility;
const DEFAULT_NAV_ORDER: string[] = [...NAV_TAB_IDS];

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

const THEME_TOGGLE_SCRIPT = `
(function () {
  const btn = document.getElementById("theme-toggle-btn");
  if (!btn) return;

  function effectiveTheme() {
    const explicit = document.documentElement.getAttribute("data-theme");
    if (explicit) return explicit;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  function updateIcon() {
    btn.textContent = effectiveTheme() === "dark" ? "☀️" : "🌙";
  }

  btn.addEventListener("click", () => {
    const next = effectiveTheme() === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("donna-theme", next); } catch (e) {}
    updateIcon();
  });

  updateIcon();
})();
`;

// Static page/nav destinations — filtered entirely client-side, no server
// round-trip. Kept in sync by hand with nav.ts's MIDDLE_TAB_META; a page
// missing from this list just doesn't show up in the palette, it isn't a
// broken link.
const PALETTE_PAGES = [
  { title: "Home", href: "/donna" },
  { title: "Calendar", href: "/donna/calendar" },
  { title: "Reminders", href: "/donna/reminders" },
  { title: "IPOs", href: "/donna/ipos" },
  { title: "Chat", href: "/donna/chat" },
  { title: "School", href: "/donna/school" },
  { title: "Finances", href: "/donna/finances" },
  { title: "Contacts", href: "/donna/contacts" },
  { title: "Info", href: "/donna/info" },
  { title: "Files", href: "/donna/files" },
  { title: "Settings", href: "/donna/settings" },
];

function renderCommandPaletteMarkup(): string {
  return `
  <div class="modal-scrim" id="palette-scrim">
    <div class="modal-panel palette-panel" id="palette-panel" onclick="event.stopPropagation()">
      <input type="text" id="palette-input" class="palette-input" placeholder="Search or type a command…" autocomplete="off" />
      <div id="palette-results" class="palette-results"></div>
    </div>
  </div>`;
}

// The command palette: full omnisearch (static pages, filtered client-side;
// reminders/contacts/classes/newsletters/uploads, via the server) plus a
// small, deliberately curated set of quick-action prefixes. Global across
// every page (like the chat FAB), triggered by Cmd/Ctrl+K or the sidebar
// trigger button.
const COMMAND_PALETTE_SCRIPT = `
(function () {
  const PALETTE_PAGES = ${JSON.stringify(PALETTE_PAGES)};
  const scrim = document.getElementById("palette-scrim");
  const input = document.getElementById("palette-input");
  const resultsEl = document.getElementById("palette-results");
  if (!scrim || !input || !resultsEl) return;

  let items = [];
  let activeIndex = -1;
  let searchTimer = null;

  function escapeHtml(s) {
    const div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
  }

  function renderRow(item, i) {
    const sub = item.subtitle ? '<div class="hint" style="margin-top:2px;">' + escapeHtml(item.subtitle) + '</div>' : "";
    return '<div class="reminder-row palette-row" data-index="' + i + '">' +
      '<div class="reminder-body"><span class="reminder-title">' + escapeHtml(item.title) + '</span>' + sub + '</div></div>';
  }

  function highlight() {
    Array.prototype.forEach.call(resultsEl.querySelectorAll(".palette-row"), function (el, i) {
      el.classList.toggle("palette-row-active", i === activeIndex);
    });
  }

  function renderItems(newItems) {
    items = newItems;
    activeIndex = items.length > 0 ? 0 : -1;
    resultsEl.innerHTML = items.length
      ? items.map(renderRow).join("")
      : '<p class="empty" style="padding:8px;">No results.</p>';
    Array.prototype.forEach.call(resultsEl.querySelectorAll(".palette-row"), function (el, i) {
      el.addEventListener("click", function () { selectItem(i); });
    });
    highlight();
  }

  function renderStatic(query) {
    const q = query.trim().toLowerCase();
    const pages = q ? PALETTE_PAGES.filter((p) => p.title.toLowerCase().includes(q)) : PALETTE_PAGES;
    renderItems(pages.map((p) => ({ title: p.title, href: p.href })));
  }

  function selectItem(i) {
    const item = items[i];
    if (item && item.href) {
      close();
      window.location.href = item.href;
    }
  }

  // A small, deliberately curated set of prefixes — not a full
  // natural-language parser. Anything more open-ended belongs in the
  // Chat tab, which already exists for exactly that.
  async function tryQuickAction(query) {
    const m = query.match(/^(?:remind me to|add reminder:?)\\s+(.+)/i);
    if (!m) return false;
    const title = m[1].trim();
    if (!title) return false;
    resultsEl.innerHTML = '<p class="hint" style="padding:8px;">Adding reminder…</p>';
    try {
      await fetch("/donna/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "action=add&title=" + encodeURIComponent(title),
      });
    } catch (err) {}
    close();
    window.location.href = "/donna/reminders";
    return true;
  }

  async function runSearch(query) {
    if (await tryQuickAction(query)) return;

    const q = query.trim();
    renderStatic(q);
    if (!q) return;

    const staticItems = items;
    try {
      const res = await fetch("/api/donna-chat?page=search&q=" + encodeURIComponent(q));
      const data = await res.json();
      const dynamic = (data.results || []).map((r) => ({ title: r.title, subtitle: r.subtitle, href: r.href }));
      renderItems(staticItems.concat(dynamic));
    } catch (err) {
      // Static results (already rendered) still work even if the dynamic
      // fetch fails — no extra results beyond that is an acceptable
      // degradation, not an error state worth surfacing.
    }
  }

  function open() {
    scrim.classList.add("open");
    input.value = "";
    renderStatic("");
    input.focus();
  }

  function close() {
    scrim.classList.remove("open");
  }
  window.__paletteOpen = open;

  input.addEventListener("input", function () {
    clearTimeout(searchTimer);
    const query = input.value;
    searchTimer = setTimeout(function () { runSearch(query); }, 200);
  });

  input.addEventListener("keydown", function (e) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      activeIndex = Math.min(activeIndex + 1, items.length - 1);
      highlight();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      activeIndex = Math.max(activeIndex - 1, 0);
      highlight();
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0) selectItem(activeIndex);
    } else if (e.key === "Escape") {
      close();
    }
  });

  scrim.addEventListener("click", close);

  document.addEventListener("keydown", function (e) {
    const isMac = navigator.platform.toUpperCase().indexOf("MAC") !== -1;
    const modifierPressed = isMac ? e.metaKey : e.ctrlKey;
    if (modifierPressed && e.key.toLowerCase() === "k") {
      e.preventDefault();
      open();
    }
  });
})();
`;

function renderChatFabMarkup(): string {
  return `
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
  </div>
  <button class="chat-fab" id="chat-fab" aria-label="Open chat">&#x1F4AC;</button>`;
}

// Every page navigation here is a full server-rendered reload, so there's
// no client-side router to hook a spinner into — this just gives instant
// visual feedback the instant a nav click/form submit registers, which is
// most of what "feels laggy" actually is when the real load is slow.
const PROGRESS_BAR_SCRIPT = `
(function () {
  const bar = document.getElementById("nav-progress-bar");
  if (!bar) return;

  function start() {
    bar.classList.add("active");
  }

  document.addEventListener("click", (e) => {
    const link = e.target && e.target.closest && e.target.closest('a[href^="/donna"]');
    if (!link || link.target === "_blank") return;
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    start();
  });

  document.addEventListener("submit", (e) => {
    if (e.target && e.target.tagName === "FORM") start();
  });

  // A back/forward-cache restore brings back the exact DOM state from
  // the moment of navigating away, "active" class included — without
  // this the bar would sit there permanently lit on a bfcache-restored
  // page since no real navigation ever happens to reset it.
  window.addEventListener("pageshow", (e) => {
    if (e.persisted) bar.classList.remove("active");
  });
})();
`;

const NAV_SHEET_SCRIPT = `
(function () {
  const btn = document.getElementById("bottom-nav-more-btn");
  const sheet = document.getElementById("bottom-nav-sheet");
  if (!btn || !sheet) return;

  function close() {
    sheet.classList.remove("open");
  }

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    sheet.classList.toggle("open");
  });
  document.addEventListener("click", (e) => {
    if (sheet.classList.contains("open") && !sheet.contains(e.target) && e.target !== btn) close();
  });
})();
`;

const CHAT_FAB_SCRIPT = `
(function () {
  const fab = document.getElementById("chat-fab");
  const scrim = document.getElementById("chat-scrim");
  const panel = document.getElementById("chat-overlay-panel");
  const closeBtn = document.getElementById("chat-overlay-close");
  const body = document.getElementById("chat-overlay-body");
  const input = document.getElementById("chat-overlay-input");
  const sendBtn = document.getElementById("chat-overlay-send");
  if (!fab) return;
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

  fab.addEventListener("click", open);
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
<style>
${BASE_STYLES}
</style>
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
      <nav class="sidebar-nav">${renderSidebarNav(activeTab, navVisibility, navOrder)}</nav>
      <div class="sidebar-user">
        <div class="sidebar-user-avatar"></div>
        <div class="sidebar-user-name">Nathan</div>
        <button class="theme-toggle-btn" id="theme-toggle-btn" title="Toggle theme" aria-label="Toggle theme">&#x1F319;</button>
        <a class="sidebar-user-logout" href="/donna/logout" title="Sign out">&#x2715;</a>
      </div>
    </aside>

    <main class="main-content">
      ${bodyHtml}
    </main>
  </div>

  <nav class="bottom-nav">${renderBottomNav(activeTab, navVisibility, navOrder)}</nav>

  ${renderCommandPaletteMarkup()}
  ${extraBodyHtml}
  ${showChatFab ? renderChatFabMarkup() : ""}

  <script>
${PROGRESS_BAR_SCRIPT}
${NAV_SHEET_SCRIPT}
${THEME_TOGGLE_SCRIPT}
${COMMAND_PALETTE_SCRIPT}
${pageScript}
${showChatFab ? CHAT_FAB_SCRIPT : ""}
  </script>
</body>
</html>`;
}
