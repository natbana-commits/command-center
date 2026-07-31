import type { VercelRequest, VercelResponse } from "@vercel/node";
import { saveSettings } from "../src/config.js";
import { addClassFolder, deleteClassFolder } from "../src/drive/classFolders.js";
import { parseDriveFolderId } from "../src/drive/list.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).send("Method not allowed");
    return;
  }

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
}
