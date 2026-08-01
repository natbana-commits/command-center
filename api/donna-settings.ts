import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { HomeWidgetId } from "../src/config.js";
import { loadSettings, saveSettings } from "../src/config.js";
import { getClassFolders, addClassFolder, deleteClassFolder } from "../src/drive/classFolders.js";
import { parseDriveFolderId } from "../src/drive/list.js";
import { getWatchlistEntries, addWatchlistEntry, deleteWatchlistEntry } from "../src/news/watchlist.js";
import { buildSettingsHtml } from "../src/donna/settingsPage.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "POST") {
    const body = (req.body ?? {}) as Record<string, string>;
    const action = body.action;

    try {
      if (action === "save-settings") {
        await saveSettings({
          timezone: body.timezone?.trim(),
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

      // A single "Dashboard" form covers both saving and reordering — each
      // submit button carries its own `action` value ("save-dashboard-
      // settings", or "move-up:<widgetId>"/"move-down:<widgetId>" from the
      // per-row arrow buttons) so one form can do both without any JS.
      // Whichever button is clicked, the checkbox/select state currently
      // shown on the page comes along with it, so a reorder click also
      // saves any visibility/tab changes made in the same view.
      const [actionType, widgetId] = action?.split(":") ?? [];
      if (actionType === "save-dashboard-settings" || actionType === "move-up" || actionType === "move-down") {
        const current = await loadSettings();
        const order = current.dashboardConfig.homeWidgets.map((w) => w.id);

        if (widgetId) {
          const idx = order.indexOf(widgetId as HomeWidgetId);
          const swapWith = actionType === "move-up" ? idx - 1 : idx + 1;
          if (idx !== -1 && swapWith >= 0 && swapWith < order.length) {
            [order[idx], order[swapWith]] = [order[swapWith], order[idx]];
          }
        }

        await saveSettings({
          dashboardConfig: {
            homeWidgets: order.map((id) => ({ id, visible: body[`widget-${id}`] === "on" })),
            defaultHomeTab: body.defaultHomeTab === "newsletters" ? "newsletters" : "news",
            navVisibility: {
              files: body["nav-files"] === "on",
              calendar: body["nav-calendar"] === "on",
              reminders: body["nav-reminders"] === "on",
              contacts: body["nav-contacts"] === "on",
            },
          },
        });
        res.redirect(303, "/donna/settings?saved=1");
        return;
      }

      if (action === "save-brief-settings") {
        const rawCount = Number(body.headlineCount);
        const headlineCount = Number.isFinite(rawCount) ? Math.min(8, Math.max(1, Math.round(rawCount))) : 4;

        await saveSettings({
          briefConfig: {
            news: body.news === "on",
            calendar: body.calendar === "on",
            reminders: body.reminders === "on",
            headlineCount,
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

  const [settings, classFolders, watchlistEntries] = await Promise.all([
    loadSettings(),
    getClassFolders(),
    getWatchlistEntries(),
  ]);
  const saved = req.query.saved === "1";
  const error = typeof req.query.error === "string" ? req.query.error : undefined;

  const html = buildSettingsHtml(settings, classFolders, watchlistEntries, saved, error);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
}
