import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getClassFolders } from "../src/drive/classFolders.js";
import { listFilesInFolder, type DriveFile } from "../src/drive/list.js";
import { getUploadsForClass, getGeneralUploads, type Upload } from "../src/storage/uploads.js";
import { isGoogleConfigured } from "../src/google/auth.js";
import { buildFilesHtml } from "../src/donna/filesPage.js";

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const googleConfigured = isGoogleConfigured();
  const classFolders = await getClassFolders();

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

  const html = buildFilesHtml({ classFolders, filesByClass, uploadsByClass, generalUploads, googleConfigured });
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
}
