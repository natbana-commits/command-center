import type { VercelRequest, VercelResponse } from "@vercel/node";
import { loadSettings } from "../src/config.js";
import { resolveTimezone, localDateTimeToIso } from "../src/util/time.js";
import { isGoogleConfigured } from "../src/google/auth.js";
import {
  listRemindersSafe,
  addReminder,
  completeReminder,
  updateReminder,
  deleteReminder,
  getReminder,
} from "../src/google/tasks.js";
import {
  scheduleNotification,
  clearPendingNotificationsForTask,
  getPendingNotificationsForTasks,
} from "../src/reminders/notifications.js";
import { buildRemindersHtml } from "../src/donna/remindersPage.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const settings = await loadSettings();
  const timezone = resolveTimezone(settings.timezone);

  if (req.method === "POST") {
    const body = (req.body ?? {}) as Record<string, string>;
    const action = body.action;

    try {
      if (action === "add") {
        const title = body.title?.trim();
        if (title) {
          const hasTime = Boolean(body.dueTime);
          const dueIso = body.dueDate ? localDateTimeToIso(body.dueDate, body.dueTime, timezone) : undefined;
          const created = await addReminder(title, body.notes?.trim() || undefined, dueIso);
          if (hasTime && dueIso) {
            await scheduleNotification(created.id, dueIso, title);
          }
        }
      } else if (action === "complete") {
        const id = body.id;
        if (id) {
          await completeReminder(id);
        }
      } else if (action === "update") {
        const id = body.id;
        const title = body.title?.trim();
        if (id && title) {
          const hasTime = Boolean(body.dueTime);
          const dueIso = body.dueDate ? localDateTimeToIso(body.dueDate, body.dueTime, timezone) : undefined;
          await updateReminder(id, { title, notes: body.notes?.trim() || "", dueIso });

          // Always clear any previously-scheduled push first — either
          // replacing it with a fresh time below, or removing it outright
          // if the time was cleared, so a stale one can't still fire.
          await clearPendingNotificationsForTask(id);
          if (hasTime && dueIso) {
            await scheduleNotification(id, dueIso, title);
          }
        }
      } else if (action === "delete") {
        const id = body.id;
        if (id) {
          await clearPendingNotificationsForTask(id);
          await deleteReminder(id);
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
  const error = req.query.error === "1" ? "Something went wrong — try again." : undefined;

  const editId = typeof req.query.edit === "string" ? req.query.edit : undefined;
  const editing = editId && googleConfigured ? await getReminder(editId).catch(() => null) : null;
  const editingNotification = editing
    ? (await getPendingNotificationsForTasks([editing.id]).catch(() => new Map())).get(editing.id) ?? null
    : null;

  const reminders = editing ? [] : await listRemindersSafe();
  const notifications = editing
    ? new Map()
    : await getPendingNotificationsForTasks(reminders.map((r) => r.id)).catch(() => new Map());

  const html = buildRemindersHtml({
    reminders,
    googleConfigured,
    timezone,
    error,
    editing,
    editingNotification,
    notifications,
  });
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
}
