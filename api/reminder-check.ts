import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sendTelegramMessage } from "../src/telegram.js";
import { getDueNotifications, markNotificationSent } from "../src/reminders/notifications.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.REMINDER_CHECK_SECRET}`) {
    res.status(401).send("Unauthorized");
    return;
  }

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
