import type { VercelRequest, VercelResponse } from "@vercel/node";
import { loadSettings } from "../src/config.js";
import { resolveTimezone, localDateKey } from "../src/util/time.js";
import { getDailyContext } from "../src/chat/dailyContext.js";
import { getChatHistory, appendChatMessage } from "../src/chat/history.js";
import { generateReply } from "../src/chat/respond.js";
import { buildChatHtml } from "../src/donna/chatPage.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const settings = await loadSettings();
  const timezone = resolveTimezone(settings.timezone);
  const day = localDateKey(new Date(), timezone);

  if (req.method === "POST") {
    const text = ((req.body ?? {}).text ?? "").toString().trim();
    if (!text) {
      res.status(400).json({ error: "Missing text" });
      return;
    }

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
    return;
  }

  const history = await getChatHistory(day);
  const html = buildChatHtml(history);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
}
