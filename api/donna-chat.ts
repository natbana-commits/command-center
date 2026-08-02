import type { VercelRequest, VercelResponse } from "@vercel/node";
import { loadSettings } from "../src/config.js";
import { resolveTimezone, localDateKey } from "../src/util/time.js";
import { getDailyContext } from "../src/chat/dailyContext.js";
import { getChatHistory, appendChatMessage } from "../src/chat/history.js";
import { generateReply } from "../src/chat/respond.js";
import { getClassFolders } from "../src/drive/classFolders.js";
import { getClassFileContext } from "../src/drive/classContext.js";
import { getSchoolChatHistory, appendSchoolChatMessage } from "../src/school/chatHistory.js";
import { generateSchoolReply } from "../src/school/respond.js";
import { buildChatTabHtml, type ChatMode } from "../src/donna/chatTabPage.js";
import { globalSearch } from "../src/search/globalSearch.js";
import { requireAuth } from "../src/auth/session.js";

// The command palette's dynamic-results lookup — folded in here (rather
// than a new file) for the same Vercel Hobby 12-function reason as the
// Chat tab above, via the same "?page=" query-param branching.
async function handleGlobalSearch(req: VercelRequest, res: VercelResponse) {
  const query = typeof req.query.q === "string" ? req.query.q : "";
  if (!query.trim()) {
    res.status(200).json({ results: [] });
    return;
  }
  try {
    const results = await globalSearch(query);
    res.status(200).json({ results });
  } catch (err) {
    console.error("Global search failed:", err);
    res.status(200).json({ results: [] });
  }
}

// The dedicated Chat tab (?page=chat) is folded into this same file —
// it shares the floating FAB's General-mode backend (same day-scoped
// chat_messages table, so the FAB and the tab are two entry points into
// one conversation, not separate threads) and reuses School's per-class
// backend for its School-mode tabs. The FAB's own bare GET/POST (no
// query param) is untouched below.
async function handleChatTabPage(req: VercelRequest, res: VercelResponse) {
  const classFolders = await getClassFolders();
  const settings = await loadSettings();

  if (req.method === "POST") {
    const body = (req.body ?? {}) as { kind?: string; classId?: number; text?: string };
    const text = (body.text ?? "").toString().trim();
    if (!text) {
      res.status(400).json({ error: "Missing text" });
      return;
    }

    try {
      if (body.kind === "school") {
        const classId = Number(body.classId);
        const cls = classFolders.find((c) => c.id === classId);
        if (!cls) {
          res.status(400).json({ error: "Unknown class" });
          return;
        }
        const [fileContext, history] = await Promise.all([
          getClassFileContext(cls),
          getSchoolChatHistory(classId),
        ]);
        const reply = await generateSchoolReply(cls.className, fileContext, history, text);
        await appendSchoolChatMessage(classId, "user", text);
        await appendSchoolChatMessage(classId, "assistant", reply);
        res.status(200).json({ reply });
        return;
      }

      const timezone = resolveTimezone(settings.timezone);
      const day = localDateKey(new Date(), timezone);
      const [context, history] = await Promise.all([getDailyContext(day), getChatHistory(day)]);
      const reply = await generateReply(context, history, text, timezone);
      await appendChatMessage(day, "user", text);
      await appendChatMessage(day, "assistant", reply);
      res.status(200).json({ reply });
    } catch (err) {
      console.error("Chat tab reply failed:", err);
      res.status(500).json({ reply: "Having trouble thinking right now — try again in a bit." });
    }
    return;
  }

  const requestedClassId = typeof req.query.classId === "string" ? Number(req.query.classId) : undefined;
  const isSchoolMode = req.query.mode === "school" && requestedClassId !== undefined;
  const activeClass = isSchoolMode ? classFolders.find((c) => c.id === requestedClassId) : undefined;

  const mode: ChatMode = activeClass ? { kind: "school", classId: activeClass.id } : { kind: "general" };
  const history = activeClass
    ? await getSchoolChatHistory(activeClass.id)
    : await (async () => {
        const timezone = resolveTimezone(settings.timezone);
        const day = localDateKey(new Date(), timezone);
        return getChatHistory(day);
      })();

  const html = buildChatTabHtml({
    classFolders,
    mode,
    activeClassName: activeClass?.className ?? null,
    history,
    navVisibility: settings.dashboardConfig.navVisibility,
    navOrder: settings.dashboardConfig.navOrder,
  });
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!(await requireAuth(req, res))) return;

  if (req.query.page === "chat") {
    await handleChatTabPage(req, res);
    return;
  }

  if (req.query.page === "search") {
    await handleGlobalSearch(req, res);
    return;
  }

  if (req.method === "GET") {
    const settings = await loadSettings();
    const timezone = resolveTimezone(settings.timezone);
    const day = localDateKey(new Date(), timezone);
    const messages = await getChatHistory(day);
    res.status(200).json({ messages });
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const text = ((req.body ?? {}).text ?? "").toString().trim();
  if (!text) {
    res.status(400).json({ error: "Missing text" });
    return;
  }

  const settings = await loadSettings();
  const timezone = resolveTimezone(settings.timezone);
  const day = localDateKey(new Date(), timezone);

  try {
    const [context, history] = await Promise.all([getDailyContext(day), getChatHistory(day)]);
    const reply = await generateReply(context, history, text, timezone);

    await appendChatMessage(day, "user", text);
    await appendChatMessage(day, "assistant", reply);

    res.status(200).json({ reply });
  } catch (err) {
    console.error("Web chat reply failed:", err);
    res.status(500).json({ reply: "Having trouble thinking right now — try again in a bit." });
  }
}
