import type { VercelRequest, VercelResponse } from "@vercel/node";
import { loadSettings } from "../src/config.js";
import { resolveTimezone, localDateKey } from "../src/util/time.js";
import { getDailyContext } from "../src/chat/dailyContext.js";
import { getNewslettersForDay } from "../src/gmail/index.js";
import { isGoogleConfigured } from "../src/google/auth.js";
import { listRemindersSafe } from "../src/google/tasks.js";
import { getRecentUploads } from "../src/storage/uploads.js";
import { getContacts } from "../src/contacts/store.js";
import { getClassFolders } from "../src/drive/classFolders.js";
import { getClassLinksForTasks } from "../src/reminders/classLinks.js";
import { getPendingNotificationsForTasks } from "../src/reminders/notifications.js";
import { getRecentIpoFilings } from "../src/ipos/store.js";
import { buildDonnaHtml } from "../src/donna/page.js";
import { generateExplanation } from "../src/donna/ask.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "POST") {
    const text = (req.body?.text ?? "").toString().trim();
    if (!text) {
      res.status(400).json({ error: "Missing text" });
      return;
    }

    try {
      const explanation = await generateExplanation(text);
      res.status(200).json({ explanation });
    } catch (err) {
      console.error("Donna ask failed:", err);
      res.status(500).json({ error: "Failed to generate explanation" });
    }
    return;
  }

  const settings = await loadSettings();
  const timezone = resolveTimezone(settings.timezone);
  const day = localDateKey(new Date(), timezone);

  const [context, newsletters, reminders, recentUploads, contacts, classFolders, ipoFilings] = await Promise.all([
    getDailyContext(day),
    getNewslettersForDay(day).catch(() => []),
    listRemindersSafe(),
    getRecentUploads(3).catch(() => []),
    getContacts().catch(() => []),
    getClassFolders().catch(() => []),
    getRecentIpoFilings(3).catch(() => []),
  ]);
  const classLinks = await getClassLinksForTasks(reminders.map((r) => r.id)).catch(() => new Map<string, number>());
  const reminderNotifications = await getPendingNotificationsForTasks(reminders.map((r) => r.id)).catch(
    () => new Map()
  );

  const html = buildDonnaHtml({
    context,
    newsletters,
    reminders,
    reminderNotifications,
    recentUploads,
    googleConfigured: isGoogleConfigured(),
    dashboardConfig: settings.dashboardConfig,
    contacts,
    classFolders,
    classLinks,
    ipoFilings,
  });
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
}
