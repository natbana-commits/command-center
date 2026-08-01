import type { NavVisibility } from "../config.js";
import { escapeHtml } from "../util/html.js";
import { BASE_STYLES } from "./styles.js";
import { PWA_HEAD, renderSidebarNav, renderBottomNav, type Tab } from "./nav.js";

const ALL_NAV_VISIBLE: NavVisibility = { files: true, calendar: true, reminders: true, contacts: true, info: true };

export interface LayoutOptions {
  title: string;
  activeTab: Tab;
  bodyHtml: string;
  extraBodyHtml?: string;
  pageScript?: string;
  showChatFab?: boolean;
  navVisibility?: NavVisibility;
}

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
  } = opts;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
${PWA_HEAD}
<style>
${BASE_STYLES}
</style>
</head>
<body>
  <div class="app-shell">
    <aside class="sidebar">
      <div class="sidebar-logo">
        <div class="sidebar-logo-mark">D</div>
        <div class="sidebar-logo-word">Donna</div>
      </div>
      <nav class="sidebar-nav">${renderSidebarNav(activeTab, navVisibility)}</nav>
      <div class="sidebar-user">
        <div class="sidebar-user-avatar"></div>
        <div class="sidebar-user-name">Nathan</div>
      </div>
    </aside>

    <main class="main-content">
      ${bodyHtml}
    </main>
  </div>

  <nav class="bottom-nav">${renderBottomNav(activeTab, navVisibility)}</nav>

  ${extraBodyHtml}
  ${showChatFab ? renderChatFabMarkup() : ""}

  <script>
${pageScript}
${showChatFab ? CHAT_FAB_SCRIPT : ""}
  </script>
</body>
</html>`;
}
