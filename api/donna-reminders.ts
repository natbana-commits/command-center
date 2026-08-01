import type { VercelRequest, VercelResponse } from "@vercel/node";
import { loadSettings } from "../src/config.js";
import { resolveTimezone, localDateTimeToIso, formatTimeLabel, withTimeSuffix } from "../src/util/time.js";
import { isGoogleConfigured } from "../src/google/auth.js";
import { getClassFolders } from "../src/drive/classFolders.js";
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
  getEarlyNotificationsForTasks,
} from "../src/reminders/notifications.js";
import { linkReminderToClass, clearClassLink, getClassIdForTask, getClassLinksForTasks } from "../src/reminders/classLinks.js";
import { buildRemindersHtml } from "../src/donna/remindersPage.js";

function parseClassId(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const id = Number(raw);
  return Number.isFinite(id) ? id : undefined;
}

const LEAD_MINUTES_PER_UNIT: Record<string, number> = { minutes: 1, hours: 60, days: 1440 };

// Parses the add/edit form's "remind me earlier" number + unit into total
// minutes. Returns undefined for blank/invalid/non-positive input rather
// than throwing — the early ping is entirely optional.
function parseLeadMinutes(rawValue: string | undefined, rawUnit: string | undefined): number | undefined {
  const value = Number(rawValue);
  const perUnit = LEAD_MINUTES_PER_UNIT[rawUnit ?? ""];
  if (!Number.isFinite(value) || value <= 0 || !perUnit) return undefined;
  return Math.round(value * perUnit);
}

function formatLeadLabel(minutes: number): string {
  if (minutes % 1440 === 0) return `${minutes / 1440} day${minutes === 1440 ? "" : "s"}`;
  if (minutes % 60 === 0) return `${minutes / 60} hour${minutes === 60 ? "" : "s"}`;
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}

// Schedules the optional early heads-up alongside the main notification —
// silently skips it if there's no lead time given or the computed early
// time has already passed (e.g. a 1-day lead on a reminder due in an hour).
async function scheduleEarlyIfRequested(
  taskId: string,
  dueIso: string,
  title: string,
  body: Record<string, string>
): Promise<void> {
  const leadMinutes = parseLeadMinutes(body.earlyLeadValue, body.earlyLeadUnit);
  if (!leadMinutes) return;

  const earlyIso = new Date(new Date(dueIso).getTime() - leadMinutes * 60000).toISOString();
  if (new Date(earlyIso).getTime() <= Date.now()) return;

  await scheduleNotification(taskId, earlyIso, `${title} (due in ${formatLeadLabel(leadMinutes)})`, "early");
}

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
          // Google Tasks' due field never shows a time in Google Tasks or
          // Calendar, so bake the real time into the title itself — the
          // only way it's visible there.
          const googleTitle = withTimeSuffix(title, hasTime && dueIso ? formatTimeLabel(dueIso, timezone) : null);
          const created = await addReminder(googleTitle, body.notes?.trim() || undefined, dueIso);
          if (hasTime && dueIso) {
            await scheduleNotification(created.id, dueIso, title);
            await scheduleEarlyIfRequested(created.id, dueIso, title, body);
          }
          const classId = parseClassId(body.classId);
          if (classId !== undefined) {
            await linkReminderToClass(created.id, classId);
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
          const googleTitle = withTimeSuffix(title, hasTime && dueIso ? formatTimeLabel(dueIso, timezone) : null);
          await updateReminder(id, { title: googleTitle, notes: body.notes?.trim() || "", dueIso });

          // Always clear any previously-scheduled push first — either
          // replacing it with a fresh time below, or removing it outright
          // if the time was cleared, so a stale one can't still fire.
          await clearPendingNotificationsForTask(id);
          if (hasTime && dueIso) {
            await scheduleNotification(id, dueIso, title);
            await scheduleEarlyIfRequested(id, dueIso, title, body);
          }

          // Same clear-then-reset approach for the class link.
          await clearClassLink(id);
          const classId = parseClassId(body.classId);
          if (classId !== undefined) {
            await linkReminderToClass(id, classId);
          }
        }
      } else if (action === "delete") {
        const id = body.id;
        if (id) {
          await clearPendingNotificationsForTask(id);
          await clearClassLink(id);
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
  const classFolders = await getClassFolders();

  const editId = typeof req.query.edit === "string" ? req.query.edit : undefined;
  const editing = editId && googleConfigured ? await getReminder(editId).catch(() => null) : null;
  const editingNotification = editing
    ? (await getPendingNotificationsForTasks([editing.id]).catch(() => new Map())).get(editing.id) ?? null
    : null;
  const editingEarlyNotification = editing
    ? (await getEarlyNotificationsForTasks([editing.id]).catch(() => new Map())).get(editing.id) ?? null
    : null;
  const editingClassId = editing ? await getClassIdForTask(editing.id).catch(() => null) : null;

  const reminders = editing ? [] : await listRemindersSafe();
  const notifications = editing
    ? new Map()
    : await getPendingNotificationsForTasks(reminders.map((r) => r.id)).catch(() => new Map());
  const earlyNotifications = editing
    ? new Map()
    : await getEarlyNotificationsForTasks(reminders.map((r) => r.id)).catch(() => new Map());
  const classLinks = editing
    ? new Map<string, number>()
    : await getClassLinksForTasks(reminders.map((r) => r.id)).catch(() => new Map<string, number>());

  const html = buildRemindersHtml({
    reminders,
    googleConfigured,
    timezone,
    error,
    editing,
    editingNotification,
    editingEarlyNotification,
    editingClassId,
    notifications,
    earlyNotifications,
    classFolders,
    classLinks,
    navVisibility: settings.dashboardConfig.navVisibility,
    navOrder: settings.dashboardConfig.navOrder,
  });
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
}
