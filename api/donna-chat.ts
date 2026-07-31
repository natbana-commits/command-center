import type { VercelRequest, VercelResponse } from "@vercel/node";
import { loadSettings } from "../src/config.js";
import { resolveTimezone, localDateKey } from "../src/util/time.js";
import { getChatHistory } from "../src/chat/history.js";
import { buildChatHtml } from "../src/donna/chatPage.js";

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const settings = await loadSettings();
  const timezone = resolveTimezone(settings.timezone);
  const day = localDateKey(new Date(), timezone);

  const history = await getChatHistory(day);

  const html = buildChatHtml(history);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
}
