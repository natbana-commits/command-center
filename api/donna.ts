import type { VercelRequest, VercelResponse } from "@vercel/node";
import { loadSettings } from "../src/config.js";
import { resolveTimezone, localDateKey, dayBounds } from "../src/util/time.js";
import { getDailyContext } from "../src/chat/dailyContext.js";
import { getNewslettersForDaySummary } from "../src/gmail/index.js";
import { isGoogleConfigured } from "../src/google/auth.js";
import { listRemindersSafe } from "../src/google/tasks.js";
import { getRecentUploadsSummary } from "../src/storage/uploads.js";
import { getContacts } from "../src/contacts/store.js";
import { getClassFolders } from "../src/drive/classFolders.js";
import { getPendingNotificationsForTasks } from "../src/reminders/notifications.js";
import { getReminderGroups, getGroupLinksForTasks } from "../src/reminders/groups.js";
import { getRecentIpoFilingsSummary } from "../src/ipos/store.js";
import { isPlaidConfigured } from "../src/finance/plaidConfig.js";
import { getAllAccounts, type PlaidAccount } from "../src/finance/accounts.js";
import { getAllItems } from "../src/finance/items.js";
import { getAccountBalanceHistoryWindows } from "../src/finance/balanceHistory.js";
import { getTransactionsForAccount } from "../src/finance/transactionsStore.js";
import { getEventsInRange, type CalendarEvent } from "../src/calendar.js";
import { getWatchlistEntries } from "../src/news/watchlist.js";
import { getWatchlistQuotes } from "../src/markets/quotes.js";
import { getUpcomingEconomicEvents } from "../src/markets/economicEvents.js";
import { buildDonnaHtml } from "../src/donna/page.js";
import { generateExplanation } from "../src/donna/ask.js";
import { buildLoginHtml } from "../src/donna/loginPage.js";
import { isAuthenticated, requireAuth, createSession, destroySession, verifyPassword } from "../src/auth/session.js";
import { isLoginLocked, recordFailedLogin, clearFailedLogins } from "../src/auth/loginAttempts.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const page = req.query.page;

  // Login/logout are handled here (rather than their own file) to stay
  // under Vercel Hobby's 12-function cap — see vercel.json's /donna/login
  // and /donna/logout rewrites, both pointed at this same function.
  if (page === "login") {
    if (req.method === "POST") {
      // Bookkeeping failures fail open (never lock Nathan out over a
      // Supabase hiccup) — see loginAttempts.ts.
      const locked = await isLoginLocked(req).catch(() => false);
      if (locked) {
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.status(429).send(buildLoginHtml("Too many attempts — try again in a few minutes."));
        return;
      }

      const password = ((req.body ?? {}).password ?? "").toString();
      if (verifyPassword(password)) {
        await clearFailedLogins(req).catch(() => {});
        await createSession(req, res);
        res.redirect(303, "/donna");
      } else {
        await recordFailedLogin(req).catch(() => {});
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.status(401).send(buildLoginHtml("Incorrect password."));
      }
      return;
    }
    if (await isAuthenticated(req)) {
      res.redirect(303, "/donna");
      return;
    }
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(200).send(buildLoginHtml());
    return;
  }

  if (page === "logout") {
    // POST-only — a GET here used to be triggerable cross-site (an <img
    // src="/donna/logout">, a prefetch, etc.), since SameSite=Lax still
    // allows top-level-navigation GETs. A POST needs a same-origin form
    // submission, which SameSite=Lax blocks from another origin.
    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }
    await destroySession(req, res);
    res.redirect(303, "/donna/login");
    return;
  }

  if (!(await requireAuth(req, res))) return;

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

  // Fresh 2-day fetch for the Home Calendar card's mini today/tomorrow
  // view — the day's cached DailyContext only ever carries today's
  // events. Calendar reads are a plain ICS pull (no OAuth), so this is
  // gated by a try/catch rather than isGoogleConfigured(), matching
  // donna-calendar.ts's own pattern. Kicked off here (rather than after
  // the Promise.all blocks below) since it depends on nothing but
  // `timezone` — starting it immediately overlaps its latency with theirs
  // instead of adding a third serial round-trip to the page load.
  const calendarPromise: Promise<{ todayEvents: CalendarEvent[]; tomorrowEvents: CalendarEvent[] }> = (async () => {
    try {
      const todayBounds = dayBounds(new Date(), timezone);
      const tomorrowBounds = dayBounds(new Date(todayBounds.end.getTime() + 1), timezone);
      const { events } = await getEventsInRange(timezone, todayBounds.start, tomorrowBounds.end);
      return {
        todayEvents: events.filter((e) => e.start < todayBounds.end),
        tomorrowEvents: events.filter((e) => e.start >= todayBounds.end),
      };
    } catch {
      // Calendar ICS feed not configured or unreachable — cards just show empty.
      return { todayEvents: [], tomorrowEvents: [] };
    }
  })();

  // Takes no arguments and has no upstream dependency, but is only ever
  // consumed alongside taskIds-dependent reads below — starting it here
  // lets it overlap with the first Promise.all instead of adding a third
  // serial round-trip on top of it.
  const reminderGroupsPromise = getReminderGroups().catch(() => []);

  const [
    context,
    newsletters,
    reminders,
    recentUploads,
    contacts,
    classFolders,
    ipoFilings,
    financeAccounts,
    financeItems,
    watchlistEntries,
    upcomingEconEvents,
  ] = await Promise.all([
    getDailyContext(day),
    getNewslettersForDaySummary(day).catch(() => []),
    listRemindersSafe(),
    getRecentUploadsSummary(3).catch(() => []),
    getContacts().catch(() => []),
    getClassFolders().catch(() => []),
    getRecentIpoFilingsSummary(12).catch(() => []),
    isPlaidConfigured() ? getAllAccounts().catch(() => []) : Promise.resolve([] as PlaidAccount[]),
    isPlaidConfigured() ? getAllItems().catch(() => []) : Promise.resolve([]),
    getWatchlistEntries().catch(() => []),
    getUpcomingEconomicEvents(timezone).catch(() => []),
  ]);
  const taskIds = reminders.map((r) => r.id);

  // The Home Finances widget charts one investment account's balance —
  // prefer whichever linked institution is named Fidelity, falling back to
  // the first investment-type account so the widget still has something
  // to show for anyone whose brokerage isn't Fidelity.
  const institutionNameByItemId = new Map(financeItems.map((it) => [it.itemId, it.institutionName]));
  const investmentAccounts = financeAccounts.filter((a) => a.type === "investment");
  const fidelityAccount =
    investmentAccounts.find((a) => (institutionNameByItemId.get(a.itemId) ?? "").toLowerCase().includes("fidelity")) ??
    investmentAccounts[0] ??
    null;
  const totalCash = financeAccounts.filter((a) => a.type === "depository").reduce((sum, a) => sum + (a.currentBalance ?? 0), 0);

  // Every linked account, for the Finances widget's account picker —
  // "Institution — Account name" so Fidelity's Roth and Individual (say)
  // read as distinct options rather than two identical "Fidelity"s.
  const financeAccountOptions = [...financeAccounts]
    .sort((a, b) => {
      const instA = institutionNameByItemId.get(a.itemId) ?? "";
      const instB = institutionNameByItemId.get(b.itemId) ?? "";
      return instA.localeCompare(instB) || a.name.localeCompare(b.name);
    })
    .map((a) => ({
      accountId: a.accountId,
      label: `${institutionNameByItemId.get(a.itemId) ?? "Account"} — ${a.name}`,
    }));

  const [
    watchlistQuotes,
    reminderNotifications,
    reminderGroups,
    groupLinks,
    { todayEvents, tomorrowEvents },
    [fidelityBalanceWeek, fidelityBalanceMonth],
    fidelityRecentTransactions,
  ] = await Promise.all([
    getWatchlistQuotes(watchlistEntries.map((e) => e.label)).catch(() => []),
    getPendingNotificationsForTasks(taskIds).catch(() => new Map()),
    reminderGroupsPromise,
    getGroupLinksForTasks(taskIds).catch(() => new Map<string, number>()),
    calendarPromise,
    fidelityAccount
      ? getAccountBalanceHistoryWindows(fidelityAccount.accountId, [7, 30]).catch(() => [[], []])
      : Promise.resolve([[], []]),
    fidelityAccount ? getTransactionsForAccount(fidelityAccount.accountId, 2).catch(() => []) : Promise.resolve([]),
  ]);

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
    ipoFilings,
    fidelityAccount,
    fidelityBalanceWeek,
    fidelityBalanceMonth,
    fidelityRecentTransactions,
    financeAccountOptions,
    totalCash,
    accountCount: financeAccounts.length,
    todayEvents,
    tomorrowEvents,
    reminderGroups,
    groupLinks,
    watchlistQuotes,
    upcomingEconEvents,
  });
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
}
