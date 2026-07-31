import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sendTelegramMessage } from "../src/telegram.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    res.status(401).send("Unauthorized");
    return;
  }

  await sendTelegramMessage("Command Center: scheduled morning brief — cron is working.");
  res.status(200).send("Message sent");
}
