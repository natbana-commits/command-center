import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getUpload } from "../src/storage/uploads.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const id = Number(req.query.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Missing or invalid id" });
    return;
  }

  const upload = await getUpload(id);
  if (!upload) {
    res.status(404).json({ error: "Upload not found" });
    return;
  }

  res.status(200).json({
    status: upload.status,
    notes: upload.notes,
    error: upload.error,
  });
}
