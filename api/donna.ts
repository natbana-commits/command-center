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
import { isPlaidConfigured } from "../src/finance/plaidClient.js";
import { getAllAccounts } from "../src/finance/accounts.js";
import { buildDonnaHtml } from "../src/donna/page.js";
import { generateExplanation } from "../src/donna/ask.js";
import { buildLoginHtml } from "../src/donna/loginPage.js";
import { buildInfoHtml } from "../src/donna/infoPage.js";
import { isAuthenticated, requireAuth, setSessionCookie, clearSessionCookie, verifyPassword } from "../src/auth/session.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const page = req.query.page;

  // Login/logout are handled here (rather than their own file) to stay
  // under Vercel Hobby's 12-function cap — see vercel.json's /donna/login
  // and /donna/logout rewrites, both pointed at this same function.
  if (page === "login") {
    if (req.method === "POST") {
      const password = ((req.body ?? {}).password ?? "").toString();
      if (verifyPassword(password)) {
        setSessionCookie(req, res);
        res.redirect(303, "/donna");
      } else {
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.status(401).send(buildLoginHtml("Incorrect password."));
      }
      return;
    }
    if (isAuthenticated(req)) {
      res.redirect(303, "/donna");
      return;
    }
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(200).send(buildLoginHtml());
    return;
  }

  if (page === "logout") {
    clearSessionCookie(req, res);
    res.redirect(303, "/donna/login");
    return;
  }

  if (!requireAuth(req, res)) return;

  // Folded in from the old api/donna-info.ts (deleted) to free a Vercel
  // Hobby function slot for api/donna-finances.ts — same "?page=" query-
  // param branching used for login/logout above.
  if (page === "info") {
    const settings = await loadSettings();
    const html = buildInfoHtml(settings.dashboardConfig.navVisibility, settings.dashboardConfig.navOrder);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(200).send(html);
    return;
  }

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

  const [context, newsletters, reminders, recentUploads, contacts, classFolders, ipoFilings, financeAccounts] =
    await Promise.all([
      getDailyContext(day),
      getNewslettersForDay(day).catch(() => []),
      listRemindersSafe(),
      getRecentUploads(3).catch(() => []),
      getContacts().catch(() => []),
      getClassFolders().catch(() => []),
      getRecentIpoFilings(3).catch(() => []),
      isPlaidConfigured() ? getAllAccounts().catch(() => []) : Promise.resolve([]),
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
    financeAccounts,
  });
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
}
