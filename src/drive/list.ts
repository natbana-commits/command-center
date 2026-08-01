import { getAccessToken } from "../google/auth.js";
import { getOrFetch } from "../util/cache.js";

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string;
  modifiedTime: string;
}

// Nothing in this app writes to Drive's file listing (uploads go to
// Supabase Storage, not Drive), so a plain TTL cache with no invalidation
// path is safe — files added directly in Drive show up within the TTL.
export async function listFilesInFolder(folderId: string): Promise<DriveFile[]> {
  return getOrFetch(`drive:files:${folderId}`, 300, async () => {
    const accessToken = await getAccessToken();

    const url = new URL("https://www.googleapis.com/drive/v3/files");
    url.searchParams.set("q", `'${folderId}' in parents and trashed = false`);
    url.searchParams.set("fields", "files(id,name,mimeType,webViewLink,modifiedTime)");
    url.searchParams.set("orderBy", "modifiedTime desc");
    url.searchParams.set("pageSize", "50");

    const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Drive list error ${response.status}: ${body}`);
    }

    const data = (await response.json()) as { files?: DriveFile[] };
    return data.files ?? [];
  });
}

// Accepts a pasted Drive folder share link (or a bare folder ID) and
// extracts the folder ID.
export function parseDriveFolderId(input: string): string | null {
  const trimmed = input.trim();
  const match = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  if (/^[a-zA-Z0-9_-]{10,}$/.test(trimmed)) return trimmed;
  return null;
}
