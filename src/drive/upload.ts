import { getAccessToken } from "../google/auth.js";
import { invalidateCache } from "../util/cache.js";

export interface DriveUploadResult {
  id: string;
  webViewLink: string;
}

// Multipart upload per Drive API v3's documented format: a JSON metadata
// part (name + parent folder) followed by the raw file bytes, joined by a
// boundary marker — no googleapis SDK dependency, matching list.ts's own
// plain-fetch approach. Needs the broader `drive` scope, not `drive.file`:
// these are pre-existing folders the user pasted a share link for, not
// files/folders the app itself created or that went through Google's
// Picker UI, and drive.file only grants access to the latter two.
export async function uploadFileToDrive(
  folderId: string,
  filename: string,
  mimeType: string,
  bytes: Buffer
): Promise<DriveUploadResult> {
  const accessToken = await getAccessToken();
  const boundary = `donna-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const metadata = JSON.stringify({ name: filename, parents: [folderId] });

  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`),
    bytes,
    Buffer.from(`\r\n--${boundary}--`),
  ]);

  const response = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  );

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Drive upload error ${response.status}: ${errBody}`);
  }

  const result = (await response.json()) as DriveUploadResult;
  // So the file shows up in the Files/School library immediately instead
  // of waiting out listFilesInFolder's 5-minute cache.
  await invalidateCache(`drive:files:${folderId}`);
  return result;
}
