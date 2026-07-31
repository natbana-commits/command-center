import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createSignedUploadUrl, createUpload, type UploadKind } from "../src/storage/uploads.js";

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

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
