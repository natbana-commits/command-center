import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createSignedUploadUrl, createSignedDownloadUrl, createUpload, getUpload, updateUpload, downloadUpload, type UploadKind } from "../src/storage/uploads.js";
import { transcribeAudio, isOpenAiConfigured, FileTooLargeError } from "../src/transcription/whisper.js";
import { generateNotesFromTranscript } from "../src/transcription/notes.js";
import { extractTextFromImage } from "../src/vision/ocr.js";
import { requireAuth } from "../src/auth/session.js";
import { isRateLimited } from "../src/auth/rateLimit.js";
import { getClassFolders } from "../src/drive/classFolders.js";
import { uploadFileToDrive } from "../src/drive/upload.js";
import { isGoogleConfigured } from "../src/google/auth.js";

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function mimeTypeFromFilename(filename: string): string {
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  const map: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    heic: "image/heic",
  };
  return map[ext] ?? "image/jpeg";
}

// Used for Drive-mirroring the generic "file" kind and lecture recordings
// (photo already has mimeTypeFromFilename above). Browsers do send the
// real File.type at upload time, but plumbing it through would mean a DB
// column just for this — a best-guess from the extension is standard
// practice and good enough for Drive's metadata (icon/preview), which is
// all it's used for.
function guessMimeTypeFromFilename(filename: string): string {
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  const map: Record<string, string> = {
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ppt: "application/vnd.ms-powerpoint",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    txt: "text/plain",
    csv: "text/csv",
    zip: "application/zip",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    heic: "image/heic",
    mp3: "audio/mpeg",
    m4a: "audio/mp4",
    wav: "audio/wav",
    ogg: "audio/ogg",
  };
  return map[ext] ?? "application/octet-stream";
}

// Best-effort: copies a completed upload into its class's real Drive
// folder so it shows up there too, not just in Donna's own storage —
// failures (most likely: the current Google token predates write access
// being granted) are logged but never fail the upload itself, which has
// already succeeded in Donna's own storage by this point regardless.
async function mirrorToDriveIfClassLinked(
  classId: number | null,
  filename: string,
  mimeType: string,
  bytes: Buffer
): Promise<void> {
  if (!classId || !isGoogleConfigured()) return;
  try {
    const classFolders = await getClassFolders();
    const cls = classFolders.find((c) => c.id === classId);
    if (!cls) return;
    await uploadFileToDrive(cls.driveFolderId, filename, mimeType, bytes);
  } catch (err) {
    console.error(`Drive mirror failed for upload "${filename}" (class ${classId}):`, err);
  }
}

async function handleInit(req: VercelRequest, res: VercelResponse) {
  const body = (req.body ?? {}) as { filename?: string; kind?: string; classId?: number };
  const filename = body.filename?.trim();
  const kind = body.kind as UploadKind | undefined;
  const classId = body.classId ?? null;

  if (!filename || (kind !== "lecture" && kind !== "photo" && kind !== "file")) {
    res.status(400).json({ error: "Missing filename or invalid kind" });
    return;
  }

  try {
    const path = `${kind}/${Date.now()}-${sanitizeFilename(filename)}`;
    const { signedUrl, token } = await createSignedUploadUrl(path);
    const upload = await createUpload({
      storagePath: path,
      kind,
      classId,
      originalFilename: filename,
    });

    res.status(200).json({ uploadId: upload.id, signedUrl, token, path });
  } catch (err) {
    console.error("Upload init failed:", err);
    res.status(500).json({ error: "Failed to initialize upload" });
  }
}

async function handleComplete(req: VercelRequest, res: VercelResponse) {
  const uploadId = Number((req.body ?? {}).uploadId);
  if (!Number.isFinite(uploadId)) {
    res.status(400).json({ error: "Missing or invalid uploadId" });
    return;
  }

  const upload = await getUpload(uploadId);
  if (!upload) {
    res.status(404).json({ error: "Upload not found" });
    return;
  }

  // Vercel's Node.js functions don't guarantee execution continues after a
  // response is sent (no background-work support here), so processing has
  // to finish before we respond. maxDuration for this function is raised in
  // vercel.json to give it room.
  try {
    await updateUpload(uploadId, { status: "processing" });
    const fileBytes = await downloadUpload(upload.storagePath);

    if (upload.kind === "lecture") {
      if (!isOpenAiConfigured()) {
        const error = "Transcription isn't set up yet — add OPENAI_API_KEY.";
        await updateUpload(uploadId, { status: "failed", error });
        res.status(200).json({ status: "failed", error });
        return;
      }
      const transcript = await transcribeAudio(fileBytes, upload.originalFilename);
      const notes = await generateNotesFromTranscript(transcript);
      await updateUpload(uploadId, { status: "done", transcript, notes });
      await mirrorToDriveIfClassLinked(upload.classId, upload.originalFilename, guessMimeTypeFromFilename(upload.originalFilename), fileBytes);
      res.status(200).json({ status: "done", notes });
    } else if (upload.kind === "photo") {
      const mimeType = mimeTypeFromFilename(upload.originalFilename);
      const text = await extractTextFromImage(fileBytes, mimeType);
      await updateUpload(uploadId, { status: "done", notes: text });
      await mirrorToDriveIfClassLinked(upload.classId, upload.originalFilename, mimeType, fileBytes);
      res.status(200).json({ status: "done", notes: text });
    } else {
      // Generic "file" kind — no transcription/OCR pipeline, just stored
      // (and, if linked to a class, mirrored to its real Drive folder).
      await updateUpload(uploadId, { status: "done" });
      await mirrorToDriveIfClassLinked(upload.classId, upload.originalFilename, guessMimeTypeFromFilename(upload.originalFilename), fileBytes);
      res.status(200).json({ status: "done" });
    }
  } catch (err) {
    // FileTooLargeError's message is a deliberately crafted, safe,
    // user-facing string (file size + limit) — everything else could be a
    // raw error from OpenAI/OCR/Supabase, so it's logged but not returned.
    const message =
      err instanceof FileTooLargeError ? err.message : "Something went wrong processing this upload — try again.";
    console.error(`Upload ${uploadId} processing failed:`, err);
    await updateUpload(uploadId, { status: "failed", error: message });
    res.status(200).json({ status: "failed", error: message });
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!(await requireAuth(req, res))) return;

  // View/download a file uploaded through the app — the library only ever
  // linked out for real Drive files, leaving anything stored in Donna's
  // own storage unclickable. A short-lived signed URL, redirected to
  // rather than proxied, so large files don't round-trip through this
  // function.
  if (req.method === "GET" && typeof req.query.view === "string") {
    const uploadId = Number(req.query.view);
    if (!Number.isFinite(uploadId)) {
      res.status(400).send("Invalid upload id");
      return;
    }
    const upload = await getUpload(uploadId);
    if (!upload) {
      res.status(404).send("Not found");
      return;
    }
    try {
      const signedUrl = await createSignedDownloadUrl(upload.storagePath);
      res.redirect(302, signedUrl);
    } catch (err) {
      console.error(`Failed to create download URL for upload ${uploadId}:`, err);
      res.status(500).send("Failed to generate download link");
    }
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  // Guards against a compromised session hammering the transcription/OCR
  // APIs behind "complete" — 10 per 15min is generous for a real multi-file
  // upload session.
  if (await isRateLimited(req, "upload", 10, 15).catch(() => false)) {
    res.status(429).json({ error: "Too many uploads — slow down a bit and try again shortly." });
    return;
  }

  const stage = (req.body ?? {}).stage;
  if (stage === "init") {
    await handleInit(req, res);
    return;
  }
  if (stage === "complete") {
    await handleComplete(req, res);
    return;
  }
  res.status(400).json({ error: "Missing or invalid stage" });
}
