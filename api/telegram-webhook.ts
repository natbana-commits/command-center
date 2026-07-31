import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sendTelegramMessage } from "../src/telegram.js";
import { getLatestPendingStories, resolvePendingStories } from "../src/news/pending.js";
import { getDailyContext } from "../src/chat/dailyContext.js";
import { getChatHistory, appendChatMessage } from "../src/chat/history.js";
import { generateReply } from "../src/chat/respond.js";
import { chunkText } from "../src/util/chunk.js";
import { localDateKey, resolveTimezone } from "../src/util/time.js";
import { loadSettings } from "../src/config.js";

const AFFIRMATIVE = /^(y|yes|yeah|yep|yea)[.!]?$/i;
const NEGATIVE = /^(n|no|nope|nah)[.!]?$/i;

interface TelegramUpdate {
  message?: {
    chat?: { id?: number | string };
    text?: string;
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const secret = req.headers["x-telegram-bot-api-secret-token"];
  if (secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    res.status(401).send("Unauthorized");
    return;
  }

  const update = req.body as TelegramUpdate;
  const chatId = update.message?.chat?.id;
  const text = (update.message?.text ?? "").trim();

  if (String(chatId) !== process.env.TELEGRAM_CHAT_ID) {
    res.status(200).send("ignored");
    return;
  }

  if (!text) {
    res.status(200).send("ok");
    return;
  }

  const pending = await getLatestPendingStories();
  if (pending && (AFFIRMATIVE.test(text) || NEGATIVE.test(text))) {
    await resolvePendingStories(pending.id);

    if (AFFIRMATIVE.test(text)) {
      for (const url of pending.urls) {
        await sendTelegramMessage(url);
      }
    } else {
      await sendTelegramMessage("No problem — see you tomorrow.");
    }

    res.status(200).send("ok");
    return;
  }

  // Conversational path: anything that isn't a clean yes/no to the pending
  // prompt falls through here, and the pending row (if any) is left
  // untouched — a later plain "yes" still works regardless of what other
  // questions were asked in between.
  const settings = await loadSettings();
  const timezone = resolveTimezone(settings.timezone);
  const day = localDateKey(new Date(), timezone);

  try {
    const [context, history] = await Promise.all([getDailyContext(day), getChatHistory(day)]);
    const reply = await generateReply(context, history, text);

    await appendChatMessage(day, "user", text);
    await appendChatMessage(day, "assistant", reply);

    for (const chunk of chunkText(reply)) {
      await sendTelegramMessage(chunk);
    }
  } catch (err) {
    console.error("Chat reply failed:", err);
    await sendTelegramMessage("Having trouble thinking right now — try again in a bit.");
  }

  res.status(200).send("ok");
}
