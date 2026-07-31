import type { VercelRequest, VercelResponse } from "@vercel/node";
import { isGoogleConfigured } from "../src/google/auth.js";
import { listRemindersSafe, addReminder, completeReminder } from "../src/google/tasks.js";
import { buildRemindersHtml } from "../src/donna/remindersPage.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "POST") {
    const body = (req.body ?? {}) as Record<string, string>;
    const action = body.action;

    try {
      if (action === "add") {
        const title = body.title?.trim();
        if (title) {
          await addReminder(title);
        }
      } else if (action === "complete") {
        const id = body.id;
        if (id) {
          await completeReminder(id);
        }
      }
      res.redirect(303, "/donna/reminders");
    } catch (err) {
      console.error("Reminder action failed:", err);
      res.redirect(303, "/donna/reminders?error=1");
    }
    return;
  }

  const googleConfigured = isGoogleConfigured();
  const reminders = await listRemindersSafe();
  const error = req.query.error === "1" ? "Something went wrong — try again." : undefined;

  const html = buildRemindersHtml({ reminders, googleConfigured, error });
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
}
