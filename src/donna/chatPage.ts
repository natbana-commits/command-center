import type { ChatMessage } from "../chat/history.js";
import { escapeHtml } from "../util/html.js";
import { renderLayout } from "./layout.js";

function renderMessage(m: ChatMessage): string {
  const cls = m.role === "user" ? "chat-bubble-user" : "chat-bubble-assistant";
  return `<div class="chat-bubble ${cls}">${escapeHtml(m.content)}</div>`;
}

export function buildChatHtml(history: ChatMessage[]): string {
  const historyHtml = history.length
    ? history.map(renderMessage).join("\n")
    : `<p class="empty">Ask Donna anything — today's news, calendar, reminders, class files, or general questions.</p>`;

  const body = `
    <div class="chat-log" id="chat-log">${historyHtml}</div>
    <div class="chat-input-row">
      <input type="text" id="chat-input" placeholder="Ask Donna anything…" autocomplete="off" />
      <button class="btn" id="chat-send">Send</button>
    </div>`;

  return renderLayout({
    title: "Donna Chat",
    activeTab: "chat",
    bodyHtml: body,
    pageScript: CLIENT_SCRIPT,
    showChatFab: false,
  });
}

const CLIENT_SCRIPT = `
  const log = document.getElementById("chat-log");
  const input = document.getElementById("chat-input");
  const sendBtn = document.getElementById("chat-send");

  function appendBubble(role, text) {
    const div = document.createElement("div");
    div.className = "chat-bubble " + (role === "user" ? "chat-bubble-user" : "chat-bubble-assistant");
    div.textContent = text;
    log.appendChild(div);
    div.scrollIntoView({ behavior: "smooth", block: "end" });
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
    log.appendChild(thinking);
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

  sendBtn.addEventListener("click", send);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") send();
  });
`;
