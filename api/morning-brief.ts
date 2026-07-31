import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sendTelegramMessage } from "../src/telegram.js";
import { buildBriefMessages } from "../src/formatBrief.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    res.status(401).send("Unauthorized");
    return;
  }

  const messages = await buildBriefMessages();
  for (const message of messages) {
    await sendTelegramMessage(message.text, message.parseMode);
  }
  res.status(200).send("Message sent");
}
