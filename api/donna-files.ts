import type { VercelRequest, VercelResponse } from "@vercel/node";
import { loadSettings } from "../src/config.js";
import { getClassFolders } from "../src/drive/classFolders.js";
import { listFilesInFolder, type DriveFile } from "../src/drive/list.js";
import { getUploadsForClass, getGeneralUploads, type Upload } from "../src/storage/uploads.js";
import { isGoogleConfigured } from "../src/google/auth.js";
import { listRemindersSafe } from "../src/google/tasks.js";
import { getClassLinksForTasks } from "../src/reminders/classLinks.js";
import { buildFilesHtml } from "../src/donna/filesPage.js";

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const googleConfigured = isGoogleConfigured();
  const [settings, classFolders, reminders] = await Promise.all([
    loadSettings(),
    getClassFolders(),
    listRemindersSafe(),
  ]);
  const classLinks = await getClassLinksForTasks(reminders.map((r) => r.id)).catch(() => new Map<string, number>());

  const filesByClass: Record<number, DriveFile[]> = {};
  const uploadsByClass: Record<number, Upload[]> = {};

  const [generalUploads] = await Promise.all([
    getGeneralUploads().catch(() => []),
    Promise.all(
      classFolders.map(async (cls) => {
        uploadsByClass[cls.id] = await getUploadsForClass(cls.id).catch(() => []);
        if (googleConfigured) {
          try {
            filesByClass[cls.id] = await listFilesInFolder(cls.driveFolderId);
          } catch (err) {
            console.error(`Failed to list files for ${cls.className}:`, err);
            filesByClass[cls.id] = [];
          }
        }
      })
    ),
  ]);

  const html = buildFilesHtml({
    classFolders,
    filesByClass,
    uploadsByClass,
    generalUploads,
    googleConfigured,
    navVisibility: settings.dashboardConfig.navVisibility,
    navOrder: settings.dashboardConfig.navOrder,
    reminders,
    classLinks,
  });
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
}
