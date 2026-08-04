import { NAV_TAB_IDS, type NavVisibility } from "../config.js";
import { escapeHtml } from "../util/html.js";
import { BASE_STYLES } from "./styles.js";
import { PWA_HEAD, renderSidebarNav, renderBottomNav, type Tab } from "./nav.js";
import { iconSettings, iconChat } from "./icons.js";

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

// Client-side page-swap router. Every nav here would otherwise be a full
// document reload (server-rendered pages, no client router) — this
// intercepts same-origin /donna/* link clicks and form submits, fetches
// just the target page, and swaps three regions (sidebar nav, bottom nav,
// and the page-content wrapper below) instead of reloading the whole
// document. The sidebar/theme-toggle/palette-trigger/chat-FAB never get
// touched, so their state (open conversation, theme, palette) survives
// navigation. Falls back to a real `window.location.href` navigation on
// any fetch failure — this is a pure enhancement, never the only way a
// page is reachable (a hard refresh on any URL always works standalone).
const ROUTER_SCRIPT = `
(function () {
  const pageContent = document.getElementById("page-content");
  const sidebarNav = document.getElementById("sidebar-nav-region");
  const bottomNav = document.getElementById("bottom-nav-region");
  const progressBar = document.getElementById("nav-progress-bar");
  if (!pageContent) return;

  const prefetched = new Set();

  function isInternalHref(href) {
    if (!href) return false;
    try {
      const url = new URL(href, window.location.href);
      return url.origin === window.location.origin && url.pathname.indexOf("/donna") === 0;
    } catch (e) {
      return false;
    }
  }

  function stopProgress() {
    if (progressBar) progressBar.classList.remove("active");
  }

  // Scripts inserted via innerHTML never execute — recreate each one so
  // it actually runs (this is what re-runs a page's own client script,
  // and the Plaid SDK's <script src="..."> tag, after every swap).
  function runScripts(container) {
    const scripts = container.querySelectorAll("script");
    Array.prototype.forEach.call(scripts, function (old) {
      const fresh = document.createElement("script");
      Array.prototype.forEach.call(old.attributes, function (attr) {
        fresh.setAttribute(attr.name, attr.value);
      });
      fresh.textContent = old.textContent;
      old.replaceWith(fresh);
    });
  }

  // A plain element id (data-swap-target="foo") scopes the swap to just
  // that element instead of the whole page — for an action whose result
  // only ever affects one region (a reminder row's complete/delete, an
  // edit-form save) a full #page-content replace is both an unnecessary
  // scroll-to-top/flash and, since it also touches every unrelated widget
  // on the page, more work than the action needs. Falls back to the full
  // swap if the target id isn't present in either the current or new DOM.
  function swapFrom(doc, swapTarget) {
    if (swapTarget) {
      const current = document.getElementById(swapTarget);
      const fresh = doc.getElementById(swapTarget);
      if (current && fresh) {
        current.innerHTML = fresh.innerHTML;
        runScripts(current);
        stopProgress();
        document.dispatchEvent(new CustomEvent("donna:swapped", { detail: { target: swapTarget } }));
        return;
      }
    }
    document.title = doc.title;
    const newPageContent = doc.getElementById("page-content");
    const newSidebarNav = doc.getElementById("sidebar-nav-region");
    const newBottomNav = doc.getElementById("bottom-nav-region");
    if (newPageContent) pageContent.innerHTML = newPageContent.innerHTML;
    if (sidebarNav && newSidebarNav) sidebarNav.innerHTML = newSidebarNav.innerHTML;
    if (bottomNav && newBottomNav) bottomNav.innerHTML = newBottomNav.innerHTML;
    runScripts(pageContent);
    window.scrollTo(0, 0);
    stopProgress();
  }

  async function navigate(url, options, push, swapTarget) {
    if (progressBar) progressBar.classList.add("active");
    try {
      const res = await fetch(url, options);
      if (!res.ok) throw new Error("bad status " + res.status);
      const text = await res.text();
      const doc = new DOMParser().parseFromString(text, "text/html");
      if (swapTarget) {
        // A scoped swap doesn't push a new history entry (it's an in-place
        // update, not a navigation to step back through) — but the server
        // may still have redirected somewhere meaningfully different (e.g.
        // saving a reminder edit leaves ?edit=<id> behind), so the address
        // bar is corrected in place with replaceState. Without this, a
        // reload right after a scoped-swap action would land back in the
        // stale view (e.g. the edit form) instead of matching what's shown.
        const target = res.url || url;
        if (target !== window.location.href) {
          history.replaceState(history.state, "", target);
        }
      } else if (push) {
        let target = res.url || url;
        const hashIndex = url.indexOf("#");
        if (hashIndex !== -1 && target.indexOf("#") === -1) target += url.slice(hashIndex);
        history.pushState({ swapped: true }, "", target);
      }
      swapFrom(doc, swapTarget);
    } catch (err) {
      // Fall back to a real navigation — never leave the click/submit
      // silently doing nothing.
      window.location.href = url;
    }
  }

  document.addEventListener("click", function (e) {
    const link = e.target && e.target.closest && e.target.closest("a[href]");
    if (!link) return;
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    if (link.target === "_blank" || link.hasAttribute("download")) return;
    if (!isInternalHref(link.getAttribute("href"))) return;
    e.preventDefault();
    navigate(link.href, { method: "GET" }, true, link.getAttribute("data-swap-target") || undefined);
  });

  document.addEventListener("submit", function (e) {
    const form = e.target;
    if (!form || form.tagName !== "FORM" || e.defaultPrevented) return;
    let url;
    try {
      // getAttribute, not form.action/form.method — every form in this app
      // has a hidden <input name="action"> for its own action dispatch,
      // which shadows the form element's built-in .action/.method IDL
      // properties (a real HTML gotcha: a named form control takes
      // precedence over the same-named built-in property). .getAttribute
      // always reads the literal HTML attribute, unaffected by that.
      url = new URL(form.getAttribute("action") || window.location.href, window.location.href);
    } catch (err) {
      return;
    }
    if (url.origin !== window.location.origin) return;
    e.preventDefault();
    const method = (form.getAttribute("method") || "GET").toUpperCase();
    const formData = new FormData(form);
    // A real native form submit includes the clicked submit button's own
    // name/value pair (e.g. <button name="action" value="move-up:...">) —
    // several forms in this app (Settings' Dashboard section) rely on
    // that instead of a hidden <input name="action">. new FormData(form)
    // alone does NOT include it (only new FormData(form, submitter) does,
    // or reading it manually via the submit event's .submitter) — without
    // this, every reorder/save click on those forms would silently POST
    // with no action at all.
    if (e.submitter && e.submitter.name) {
      formData.append(e.submitter.name, e.submitter.value);
    }
    const params = new URLSearchParams(formData);
    const swapTarget = form.getAttribute("data-swap-target") || undefined;
    if (method === "GET") {
      navigate(url.pathname + "?" + params.toString(), { method: "GET" }, true, swapTarget);
    } else {
      // URLSearchParams, not raw FormData — no form in this app declares
      // enctype="multipart/form-data", so every one of them relies on the
      // browser's native default encoding (application/x-www-form-
      // urlencoded). Sending a raw FormData body here would switch that
      // to multipart, which Vercel's built-in body parser (@vercel/node's
      // req.body) doesn't parse, silently dropping every field.
      navigate(url.pathname + url.search, { method: method, body: params }, true, swapTarget);
    }
  });

  window.addEventListener("popstate", function () {
    navigate(window.location.href, { method: "GET" }, false);
  });

  // Hover prefetch: warms the browser's own HTTP cache before the click
  // lands. mouseenter doesn't bubble, but capture-phase listeners still
  // see it on descendants, so this delegates from one document listener
  // rather than needing a listener per link.
  document.addEventListener(
    "mouseenter",
    function (e) {
      const link = e.target && e.target.closest && e.target.closest("a[href]");
      if (!link) return;
      const href = link.getAttribute("href");
      if (!isInternalHref(href) || prefetched.has(href)) return;
      prefetched.add(href);
      fetch(link.href, { method: "GET" }).catch(function () {});
    },
    true
  );
})();
`;

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

// Delegated on document (rather than binding to the button/sheet directly)
// because the client-side router replaces #bottom-nav-region's innerHTML on
// every navigation — direct bindings would go stale after the first swap,
// same reasoning as ROUTER_SCRIPT's own click handling.
const NAV_SHEET_SCRIPT = `
(function () {
  document.addEventListener("click", (e) => {
    const sheet = document.getElementById("bottom-nav-sheet");
    if (!sheet) return;
    const btn = e.target && e.target.closest && e.target.closest("#bottom-nav-more-btn");
    if (btn) {
      e.stopPropagation();
      sheet.classList.toggle("open");
      return;
    }
    if (sheet.classList.contains("open") && !sheet.contains(e.target)) {
      sheet.classList.remove("open");
    }
  });
})();
`;

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
<style>
${BASE_STYLES}
</style>
</head>
<body>
  <div class="nav-progress-bar" id="nav-progress-bar"></div>
  <a class="mobile-topbar-btn" href="/donna/settings" aria-label="Settings">${iconSettings}</a>
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
      <div id="page-content">
        ${bodyHtml}
        ${extraBodyHtml}
        <script>${pageScript}</script>
      </div>
    </main>
  </div>

  <nav class="bottom-nav" id="bottom-nav-region">${renderBottomNav(activeTab, navVisibility, navOrder)}</nav>

  ${renderCommandPaletteMarkup()}
  ${showChatFab ? renderChatFabMarkup() : ""}

  <script>
${PROGRESS_BAR_SCRIPT}
${NAV_SHEET_SCRIPT}
${COMMAND_PALETTE_SCRIPT}
${ROUTER_SCRIPT}
${showChatFab ? CHAT_FAB_SCRIPT : ""}
  </script>
</body>
</html>`;
}
