import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createSignedUploadUrl, createUpload, getUpload, updateUpload, downloadUpload, type UploadKind } from "../src/storage/uploads.js";
import { transcribeAudio, isOpenAiConfigured, FileTooLargeError } from "../src/transcription/whisper.js";
import { generateNotesFromTranscript } from "../src/transcription/notes.js";
import { extractTextFromImage } from "../src/vision/ocr.js";
import { requireAuth } from "../src/auth/session.js";

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

async function handleInit(req: VercelRequest, res: VercelResponse) {
  const body = (req.body ?? {}) as { filename?: string; kind?: string; classId?: number };
  const filename = body.filename?.trim();
  const kind = body.kind as UploadKind | undefined;
  const classId = body.classId ?? null;

  if (!filename || (kind !== "lecture" && kind !== "photo")) {
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
      res.status(200).json({ status: "done", notes });
    } else {
      const mimeType = mimeTypeFromFilename(upload.originalFilename);
      const text = await extractTextFromImage(fileBytes, mimeType);
      await updateUpload(uploadId, { status: "done", notes: text });
      res.status(200).json({ status: "done", notes: text });
    }
  } catch (err) {
    const message =
      err instanceof FileTooLargeError
        ? err.message
        : err instanceof Error
          ? err.message
          : String(err);
    console.error(`Upload ${uploadId} processing failed:`, err);
    await updateUpload(uploadId, { status: "failed", error: message });
    res.status(200).json({ status: "failed", error: message });
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!(await requireAuth(req, res))) return;

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
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
