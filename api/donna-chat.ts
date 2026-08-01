import type { VercelRequest, VercelResponse } from "@vercel/node";
import { loadSettings } from "../src/config.js";
import { resolveTimezone, localDateKey } from "../src/util/time.js";
import { getDailyContext } from "../src/chat/dailyContext.js";
import { getChatHistory, appendChatMessage } from "../src/chat/history.js";
import { generateReply } from "../src/chat/respond.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
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
