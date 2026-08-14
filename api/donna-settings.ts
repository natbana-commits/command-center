import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { HomeWidgetId, FinanceWidgetId, NavVisibility } from "../src/config.js";
import { loadSettings, saveSettings } from "../src/config.js";
import { getClassFolders, addClassFolder, renameClassFolder, deleteClassFolder } from "../src/drive/classFolders.js";
import { parseDriveFolderId } from "../src/drive/list.js";
import { getWatchlistEntries, addWatchlistEntry, deleteWatchlistEntry } from "../src/news/watchlist.js";
import { getReminderGroups, addReminderGroup, deleteReminderGroup } from "../src/reminders/groups.js";
import { getManualBills, addManualBill, deleteManualBill, updateManualBill } from "../src/finance/manualBills.js";
import { isPlaidConfigured } from "../src/finance/plaidConfig.js";
import { getRecentTransactions } from "../src/finance/transactionsStore.js";
import { detectRecurringCharges } from "../src/finance/recurringCharges.js";
import {
  getRecurringChargeOverrides,
  upsertRecurringChargeOverride,
} from "../src/finance/recurringChargeOverrides.js";
import {
  getCommunityFeedSources,
  addCommunityFeedSource,
  deleteCommunityFeedSource,
  isSafeFeedUrl,
} from "../src/news/communityFeeds.js";
import { buildSettingsHtml } from "../src/donna/settingsPage.js";
import {
  requireAuth,
  listActiveSessions,
  getCurrentSessionId,
  revokeSession,
  revokeOtherSessions,
} from "../src/auth/session.js";
import { invalidateCache } from "../src/util/cache.js";

// Intl throws RangeError on anything that isn't a real IANA zone name —
// including empty string, or a near-miss like "America/New York" (space
// instead of underscore). Every page that computes "today"
// (Home/Reminders/Calendar/Finances) and the morning-brief cron all call
// through this same timezone string on every request, so an unvalidated
// bad save here doesn't just fail once — it 500s the whole app until
// manually corrected in the database.
function isValidTimezone(candidate: string): boolean {
  if (!candidate) return false;
  if (candidate === "auto") return true; // resolveTimezone()'s own special case
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: candidate });
    return true;
  } catch {
    return false;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!(await requireAuth(req, res))) return;

  if (req.method === "POST") {
    const body = (req.body ?? {}) as Record<string, string>;
    const action = body.action;

    try {
      if (action === "save-settings") {
        const timezone = body.timezone?.trim();
        if (timezone !== undefined && !isValidTimezone(timezone)) {
          res.redirect(303, "/donna/settings?error=invalid-timezone");
          return;
        }

        await saveSettings({
          timezone,
          newsletterQuery: body.newsletterQuery?.trim(),
        });

        res.redirect(303, "/donna/settings?saved=1");
        return;
      }

      if (action === "add-class") {
        const className = body.className?.trim();
        const folderId = parseDriveFolderId(body.driveFolderLink ?? "");

        if (!className || !folderId) {
          res.redirect(303, "/donna/settings?error=invalid-link");
          return;
        }

        await addClassFolder(className, folderId);
        res.redirect(303, "/donna/settings?saved=1");
        return;
      }

      if (action === "rename-class") {
        const id = Number(body.id);
        const className = body.className?.trim();
        if (Number.isFinite(id) && className) {
          await renameClassFolder(id, className);
        }
        res.redirect(303, "/donna/settings?saved=1");
        return;
      }

      if (action === "delete-class") {
        const id = Number(body.id);
        if (Number.isFinite(id)) {
          await deleteClassFolder(id);
        }
        res.redirect(303, "/donna/settings?saved=1");
        return;
      }

      if (action === "add-watchlist-entry") {
        const label = body.label?.trim();
        if (label) {
          await addWatchlistEntry(label);
        }
        res.redirect(303, "/donna/settings?saved=1");
        return;
      }

      if (action === "delete-watchlist-entry") {
        const id = Number(body.id);
        if (Number.isFinite(id)) {
          await deleteWatchlistEntry(id);
        }
        res.redirect(303, "/donna/settings?saved=1");
        return;
      }

      if (action === "add-community-feed-source") {
        const url = body.url?.trim();
        const label = body.label?.trim();
        if (url && !isSafeFeedUrl(url)) {
          res.redirect(303, "/donna/settings?error=invalid-feed-url");
          return;
        }
        if (url && label) {
          await addCommunityFeedSource(url, label);
          // Same 15-minute cache donna-calendar.ts/donna-news.ts already
          // invalidate for their own writes — without this, a newly added
          // source shows no items (and a deleted one keeps showing its
          // old items) for up to 15 minutes.
          await invalidateCache("community-feed-items");
        }
        res.redirect(303, "/donna/settings?saved=1");
        return;
      }

      if (action === "delete-community-feed-source") {
        const id = Number(body.id);
        if (Number.isFinite(id)) {
          await deleteCommunityFeedSource(id);
          await invalidateCache("community-feed-items");
        }
        res.redirect(303, "/donna/settings?saved=1");
        return;
      }

      if (action === "add-reminder-group") {
        const name = body.name?.trim();
        const color = body.color?.trim();
        if (name && color) {
          await addReminderGroup(name, color);
        }
        res.redirect(303, "/donna/settings?saved=1");
        return;
      }

      if (action === "delete-reminder-group") {
        const id = Number(body.id);
        if (Number.isFinite(id)) {
          await deleteReminderGroup(id);
        }
        res.redirect(303, "/donna/settings?saved=1");
        return;
      }

      if (action === "add-manual-bill") {
        const name = body.name?.trim();
        const amount = Number(body.amount);
        const dueDay = Number(body.dueDay);
        if (name && Number.isFinite(amount) && amount >= 0 && Number.isInteger(dueDay) && dueDay >= 1 && dueDay <= 31) {
          await addManualBill(name, amount, dueDay);
        }
        res.redirect(303, "/donna/settings?saved=1");
        return;
      }

      if (action === "update-manual-bill") {
        const id = Number(body.id);
        const name = body.name?.trim();
        const amount = Number(body.amount);
        const dueDay = Number(body.dueDay);
        if (Number.isFinite(id) && name && Number.isFinite(amount) && amount >= 0 && Number.isInteger(dueDay) && dueDay >= 1 && dueDay <= 31) {
          await updateManualBill(id, name, amount, dueDay);
        }
        res.redirect(303, "/donna/settings?saved=1");
        return;
      }

      if (action === "delete-manual-bill") {
        const id = Number(body.id);
        if (Number.isFinite(id)) {
          await deleteManualBill(id);
        }
        res.redirect(303, "/donna/settings?saved=1");
        return;
      }

      if (action === "update-recurring-charge-override") {
        const merchantKey = body.merchantKey;
        const displayName = body.displayName?.trim();
        // Number("") is 0, which passes a bare Number.isFinite/>=0 check —
        // trim-and-check-for-emptiness first so a blanked field is
        // rejected instead of silently saving as a permanent $0.00/mo.
        const rawAmount = body.amountOverride?.trim();
        const amountOverride = rawAmount ? Number(rawAmount) : NaN;
        if (merchantKey && displayName && Number.isFinite(amountOverride) && amountOverride >= 0) {
          await upsertRecurringChargeOverride(merchantKey, { displayName, amountOverride });
        }
        res.redirect(303, "/donna/settings?saved=1");
        return;
      }

      if (action === "dismiss-recurring-charge") {
        if (body.merchantKey) {
          await upsertRecurringChargeOverride(body.merchantKey, { dismissed: true });
        }
        res.redirect(303, "/donna/settings?saved=1");
        return;
      }

      if (action === "restore-recurring-charge") {
        if (body.merchantKey) {
          await upsertRecurringChargeOverride(body.merchantKey, { dismissed: false });
        }
        res.redirect(303, "/donna/settings?saved=1");
        return;
      }

      if (action === "revoke-session") {
        if (body.id) {
          await revokeSession(body.id);
        }
        res.redirect(303, "/donna/settings?saved=1");
        return;
      }

      if (action === "revoke-other-sessions") {
        const currentSessionId = getCurrentSessionId(req);
        if (currentSessionId) {
          await revokeOtherSessions(currentSessionId);
        }
        res.redirect(303, "/donna/settings?saved=1");
        return;
      }

      if (action === "save-dashboard-settings") {
        const current = await loadSettings();
        const navOrder = current.dashboardConfig.navOrder;
        const navVisibility = Object.fromEntries(
          navOrder.map((tab) => [tab, body[`nav-${tab}`] === "on"])
        ) as unknown as NavVisibility;

        await saveSettings({
          dashboardConfig: {
            ...current.dashboardConfig,
            homeWidgets: current.dashboardConfig.homeWidgets.map((w) => ({
              id: w.id,
              visible: body[`widget-${w.id}`] === "on",
            })),
            financeWidgets: current.dashboardConfig.financeWidgets.map((w) => ({
              id: w.id,
              visible: body[`fin-widget-${w.id}`] === "on",
            })),
            defaultNewsTab: body.defaultNewsTab === "newsletters" ? "newsletters" : "news",
            navVisibility,
          },
        });
        res.redirect(303, "/donna/settings?saved=1");
        return;
      }

      // Drag-reorder auto-saves on drop (see SETTINGS_CLIENT_SCRIPT) as a
      // standalone fetch carrying only the new order — not the whole
      // Dashboard form — so each of these three only ever touches its own
      // one array, preserving every widget/tab's current visibility rather
      // than re-deriving it from a body that was never sent. Order is
      // filtered to known ids and anything missing from it (a stale
      // client, a partial submission) is appended at the end rather than
      // silently dropped from Settings.
      if (action === "reorder-widgets" || action === "reorder-fin-widgets" || action === "reorder-nav") {
        const current = await loadSettings();
        const order = (body.order ?? "").split(",").filter(Boolean);

        if (action === "reorder-widgets") {
          const byId = new Map(current.dashboardConfig.homeWidgets.map((w) => [w.id, w]));
          const reordered = order.map((id) => byId.get(id as HomeWidgetId)).filter((w) => w !== undefined);
          const missing = current.dashboardConfig.homeWidgets.filter((w) => !order.includes(w.id));
          await saveSettings({
            dashboardConfig: { ...current.dashboardConfig, homeWidgets: [...reordered, ...missing] },
          });
        } else if (action === "reorder-fin-widgets") {
          const byId = new Map(current.dashboardConfig.financeWidgets.map((w) => [w.id, w]));
          const reordered = order.map((id) => byId.get(id as FinanceWidgetId)).filter((w) => w !== undefined);
          const missing = current.dashboardConfig.financeWidgets.filter((w) => !order.includes(w.id));
          await saveSettings({
            dashboardConfig: { ...current.dashboardConfig, financeWidgets: [...reordered, ...missing] },
          });
        } else {
          const known = current.dashboardConfig.navOrder;
          const reordered = order.filter((tab) => known.includes(tab));
          const missing = known.filter((tab) => !order.includes(tab));
          await saveSettings({
            dashboardConfig: { ...current.dashboardConfig, navOrder: [...reordered, ...missing] },
          });
        }
        res.redirect(303, "/donna/settings?saved=1");
        return;
      }

      if (action === "save-brief-settings") {
        const rawCount = Number(body.headlineCount);
        const headlineCount = Number.isFinite(rawCount) ? Math.min(8, Math.max(1, Math.round(rawCount))) : 4;
        const rawDay = Number(body.weeklyDigestDay);
        const weeklyDigestDay = Number.isFinite(rawDay) ? Math.min(6, Math.max(0, Math.round(rawDay))) : 0;
        // <input type="time"> always submits "HH:MM" — this guard only
        // matters against a hand-crafted request bypassing the form.
        const sendTime = /^([01]\d|2[0-3]):[0-5]\d$/.test(body.sendTime ?? "") ? body.sendTime : "06:00";

        await saveSettings({
          briefConfig: {
            news: body.news === "on",
            calendar: body.calendar === "on",
            reminders: body.reminders === "on",
            ipos: body.ipos === "on",
            headlineCount,
            weeklyDigestEnabled: body.weeklyDigestEnabled === "on",
            weeklyDigestDay,
            sendTime,
          },
        });
        res.redirect(303, "/donna/settings?saved=1");
        return;
      }

      res.status(400).send("Unknown action");
    } catch (err) {
      console.error("Settings save failed:", err);
      res.status(500).send("Failed to save settings");
    }
    return;
  }

  const [settings, classFolders, watchlistEntries, reminderGroups, communityFeedSources, sessions, manualBills, recurringChargeOverrides, recurringChargeTransactions] =
    await Promise.all([
      loadSettings(),
      getClassFolders(),
      getWatchlistEntries(),
      getReminderGroups(),
      getCommunityFeedSources(),
      listActiveSessions(),
      getManualBills(),
      getRecurringChargeOverrides().catch(() => []),
      // Same 300-transaction pull donna-finances.ts uses for its own
      // recurring-charge detection — this page needs the raw (pre-
      // dismissal) list so a dismissed merchant still shows up here to
      // restore, unlike the Finances widget.
      isPlaidConfigured() ? getRecentTransactions(300).catch(() => []) : Promise.resolve([]),
    ]);
  const recurringCharges = detectRecurringCharges(recurringChargeTransactions);
  const saved = req.query.saved === "1";
  const error = typeof req.query.error === "string" ? req.query.error : undefined;
  const currentSessionId = getCurrentSessionId(req);

  const html = buildSettingsHtml(
    settings,
    classFolders,
    watchlistEntries,
    reminderGroups,
    communityFeedSources,
    sessions,
    currentSessionId,
    manualBills,
    recurringCharges,
    recurringChargeOverrides,
    saved,
    error
  );
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
}
