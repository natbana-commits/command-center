import { getAccessToken } from "../google/auth.js";
import { getOrFetch } from "../util/cache.js";
import type { DriveFile } from "./list.js";
// pdf-parse's package "main" has a buggy self-test that misfires when
// bundled by esbuild (throws ENOENT trying to read a fixture file at
// import time) — importing its actual implementation directly avoids it.
import pdfParse from "pdf-parse/lib/pdf-parse.js";

const GOOGLE_DOC = "application/vnd.google-apps.document";
const GOOGLE_SLIDES = "application/vnd.google-apps.presentation";
const PDF = "application/pdf";

async function exportAsText(fileId: string, accessToken: string): Promise<string> {
  const url = new URL(`https://www.googleapis.com/drive/v3/files/${fileId}/export`);
  url.searchParams.set("mimeType", "text/plain");

  const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) {
    throw new Error(`Drive export error ${response.status}`);
  }
  return response.text();
}

async function downloadBytes(fileId: string, accessToken: string): Promise<Buffer> {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) {
    throw new Error(`Drive download error ${response.status}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// Returns "" for file types we don't extract text from (spreadsheets,
// images, etc.) rather than throwing — one unsupported file shouldn't break
// the rest of a class folder's context. Cached keyed on (id, modifiedTime) —
// unlike listFilesInFolder, this had no caching at all, so School-mode chat
// could trigger a download + PDF-parse per file on every single message. A
// long TTL is safe here since the key itself changes the moment the file is
// edited (DriveFile always carries modifiedTime), so nothing ever serves
// stale content — it just accumulates unreachable rows until they expire.
export async function getFileContent(file: DriveFile): Promise<string> {
  return getOrFetch(`drive:content:${file.id}:${file.modifiedTime}`, 30 * 24 * 60 * 60, () => fetchFileContent(file));
}

async function fetchFileContent(file: DriveFile): Promise<string> {
  try {
    const accessToken = await getAccessToken();

    if (file.mimeType === GOOGLE_DOC || file.mimeType === GOOGLE_SLIDES) {
      return await exportAsText(file.id, accessToken);
    }

    if (file.mimeType === PDF) {
      const bytes = await downloadBytes(file.id, accessToken);
      const parsed = await pdfParse(bytes);
      return parsed.text;
    }

    if (file.mimeType.startsWith("text/")) {
      const bytes = await downloadBytes(file.id, accessToken);
      return bytes.toString("utf-8");
    }

    return "";
  } catch (err) {
    console.error(`Failed to extract content from ${file.name}:`, err);
    return "";
  }
}
