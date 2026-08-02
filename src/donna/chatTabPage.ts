import type { NavVisibility } from "../config.js";
import type { ClassFolder } from "../drive/classFolders.js";
import { escapeHtml } from "../util/html.js";
import { renderLayout } from "./layout.js";

interface ChatTabMessage {
  role: "user" | "assistant";
  content: string;
}

export type ChatMode = { kind: "general" } | { kind: "school"; classId: number };

function renderModeTabs(classFolders: ClassFolder[], mode: ChatMode): string {
  const generalActive = mode.kind === "general";
  const tabs = [
    `<a class="home-tab-btn${generalActive ? " home-tab-btn-active" : ""}" href="/donna/chat">General</a>`,
    ...classFolders.map(
      (c) =>
        `<a class="home-tab-btn${mode.kind === "school" && mode.classId === c.id ? " home-tab-btn-active" : ""}" href="/donna/chat?mode=school&classId=${c.id}">${escapeHtml(c.className)}</a>`
    ),
  ];
  return tabs.join("");
}

function renderBubble(m: ChatTabMessage): string {
  const cls = m.role === "user" ? "chat-bubble-user" : "chat-bubble-assistant";
  return `<div class="chat-bubble ${cls}">${escapeHtml(m.content)}</div>`;
}

export interface ChatTabPageData {
  classFolders: ClassFolder[];
  mode: ChatMode;
  activeClassName: string | null;
  history: ChatTabMessage[];
  navVisibility: NavVisibility;
  navOrder: string[];
}

// The floating chat FAB (available on every other page) always talks to
// General mode, backed by the same day-scoped chat_messages table this
// page's General mode reads — so the FAB and this tab are two entry
// points into the literal same conversation, not separate threads.
export function buildChatTabHtml(data: ChatTabPageData): string {
  const { classFolders, mode, activeClassName, history, navVisibility, navOrder } = data;

  const subtitle = mode.kind === "general" ? "General" : `Studying for ${activeClassName}`;
  const bodyMessages =
    history.length === 0 ? `<p class="empty">Ask Donna anything.</p>` : history.map(renderBubble).join("\n");

  const modeJson = JSON.stringify(mode.kind === "general" ? { kind: "general" } : { kind: "school", classId: mode.classId });

  const body = `
    <div class="section">
      <h1 class="page-title">Chat</h1>
      <p class="page-sub">${escapeHtml(subtitle)}</p>
    </div>

    <div class="home-tabs">${renderModeTabs(classFolders, mode)}</div>

    <div class="card" style="margin-top: var(--sp-3);">
      <div id="chat-tab-body" style="display:flex; flex-direction:column; gap: var(--sp-2); max-height: 60vh; overflow-y:auto; margin-bottom: var(--sp-2);">
        ${bodyMessages}
      </div>
      <div style="display:flex; gap: var(--sp-2);">
        <input type="text" id="chat-tab-input" placeholder="Ask Donna…" autocomplete="off" style="flex:1;" />
        <button type="button" id="chat-tab-send" class="btn">Send</button>
      </div>
    </div>`;

  return renderLayout({
    title: "Donna — Chat",
    activeTab: "chat",
    bodyHtml: body,
    navVisibility,
    navOrder,
    pageScript: CLIENT_SCRIPT(modeJson),
  });
}

const CLIENT_SCRIPT = (modeJson: string) => `
(function () {
  const chatTabMode = ${modeJson};

  function appendChatTabBubble(role, text) {
    const body = document.getElementById("chat-tab-body");
    const div = document.createElement("div");
    div.className = "chat-bubble " + (role === "user" ? "chat-bubble-user" : "chat-bubble-assistant");
    div.textContent = text;
    body.appendChild(div);
    div.scrollIntoView({ behavior: "smooth", block: "end" });
    return div;
  }

  async function sendChatTabMessage(text) {
    if (!text) return;
    appendChatTabBubble("user", text);
    const thinking = appendChatTabBubble("assistant", "Thinking…");
    try {
      const res = await fetch("/donna/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.assign({ text: text }, chatTabMode)),
      });
      const data = await res.json();
      thinking.textContent = data.reply || "Not sure how to answer that one.";
    } catch (err) {
      thinking.textContent = "Couldn't reach Donna just now.";
    }
  }

  const chatTabInput = document.getElementById("chat-tab-input");
  const chatTabSendBtn = document.getElementById("chat-tab-send");
  chatTabSendBtn.addEventListener("click", () => {
    const text = chatTabInput.value.trim();
    chatTabInput.value = "";
    sendChatTabMessage(text);
  });
  chatTabInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") chatTabSendBtn.click();
  });
})();
`;
