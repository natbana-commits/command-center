import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getUpload, updateUpload, downloadUpload } from "../src/storage/uploads.js";
import { transcribeAudio, isOpenAiConfigured, FileTooLargeError } from "../src/transcription/whisper.js";
import { generateNotesFromTranscript } from "../src/transcription/notes.js";
import { extractTextFromImage } from "../src/vision/ocr.js";

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

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
