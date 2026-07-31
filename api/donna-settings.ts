import type { VercelRequest, VercelResponse } from "@vercel/node";
import { loadSettings, saveSettings } from "../src/config.js";
import { getClassFolders, addClassFolder, deleteClassFolder } from "../src/drive/classFolders.js";
import { parseDriveFolderId } from "../src/drive/list.js";
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

      res.status(400).send("Unknown action");
    } catch (err) {
      console.error("Settings save failed:", err);
      res.status(500).send("Failed to save settings");
    }
    return;
  }

  const [settings, classFolders] = await Promise.all([loadSettings(), getClassFolders()]);
  const saved = req.query.saved === "1";
  const error = typeof req.query.error === "string" ? req.query.error : undefined;

  const html = buildSettingsHtml(settings, classFolders, saved, error);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
}
