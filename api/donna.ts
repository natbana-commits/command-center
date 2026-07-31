import type { VercelRequest, VercelResponse } from "@vercel/node";
import { loadSettings } from "../src/config.js";
import { resolveTimezone, localDateKey } from "../src/util/time.js";
import { getDailyContext } from "../src/chat/dailyContext.js";
import { getNewslettersForDay } from "../src/gmail/index.js";
import { getClassFolders } from "../src/drive/classFolders.js";
import { listFilesInFolder, type DriveFile } from "../src/drive/list.js";
import { isGoogleConfigured } from "../src/google/auth.js";
import { buildDonnaHtml } from "../src/donna/page.js";

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const settings = await loadSettings();
    const timezone = resolveTimezone(settings.timezone);
    const day = localDateKey(new Date(), timezone);

    const driveConfigured = isGoogleConfigured();
    const [context, newsletters, classFolders] = await Promise.all([
      getDailyContext(day),
      getNewslettersForDay(day),
      getClassFolders(),
    ]);

    const filesByClass: Record<number, DriveFile[]> = {};
    if (driveConfigured) {
      await Promise.all(
        classFolders.map(async (cls) => {
          try {
            filesByClass[cls.id] = await listFilesInFolder(cls.driveFolderId);
          } catch (err) {
            console.error(`Failed to list files for ${cls.className}:`, err);
            filesByClass[cls.id] = [];
          }
        })
      );
    }

    const html = buildDonnaHtml({ context, newsletters, classFolders, filesByClass, driveConfigured });
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(200).send(html);
  } catch (err) {
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res
      .status(500)
      .send(`DEBUG ERROR: ${err instanceof Error ? err.stack ?? err.message : String(err)}`);
  }
}
