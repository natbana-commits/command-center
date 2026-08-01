import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sendTelegramMessage } from "../src/telegram.js";
import { buildBriefMessages } from "../src/formatBrief.js";
import { getDueNotifications, markNotificationSent } from "../src/reminders/notifications.js";

// Merged with the old api/reminder-check.ts to stay under Vercel Hobby's
// 12-function cap — both are bare secret-gated background jobs with no
// user-facing /donna/* URL, so branching on which secret the incoming
// Authorization header matches (rather than an explicit field) is
// invisible to both callers: Vercel's own cron trigger for this path,
// and .github/workflows/reminder-check.yml's poller, which still hits
// /api/reminder-check directly — see vercel.json's rewrite for that.
async function handleReminderCheck(res: VercelResponse) {
  let due;
  try {
    due = await getDueNotifications();
  } catch (err) {
    console.error("Failed to read due notifications:", err);
    res.status(500).json({ error: "Failed to read due notifications" });
    return;
  }

  let sent = 0;

  for (const notification of due) {
    try {
      await sendTelegramMessage(`⏰ Reminder: ${notification.message}`);
      await markNotificationSent(notification.id);
      sent += 1;
    } catch (err) {
      // Don't let one bad notification (e.g. a transient Supabase error
      // right after a successful send) block the rest, or silently
      // vanish — log it and move on; it'll be retried next poll unless
      // the send itself is what failed.
      console.error(`Failed to deliver/mark notification ${notification.id}:`, err);
    }
  }

  res.status(200).json({ sent, total: due.length });
}

async function handleMorningBrief(res: VercelResponse) {
  const messages = await buildBriefMessages();
  for (const message of messages) {
    await sendTelegramMessage(message.text, message.parseMode);
  }
  res.status(200).send("Message sent");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const authHeader = req.headers.authorization;

  if (authHeader === `Bearer ${process.env.REMINDER_CHECK_SECRET}`) {
    await handleReminderCheck(res);
    return;
  }
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    res.status(401).send("Unauthorized");
    return;
  }
  await handleMorningBrief(res);
}
