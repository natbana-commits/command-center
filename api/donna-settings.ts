import type { VercelRequest, VercelResponse } from "@vercel/node";
import { loadSettings } from "../src/config.js";
import { getClassFolders } from "../src/drive/classFolders.js";
import { buildSettingsHtml } from "../src/donna/settingsPage.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const [settings, classFolders] = await Promise.all([loadSettings(), getClassFolders()]);
  const saved = req.query.saved === "1";
  const error = typeof req.query.error === "string" ? req.query.error : undefined;

  const html = buildSettingsHtml(settings, classFolders, saved, error);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
}
