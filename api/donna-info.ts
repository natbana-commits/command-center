import type { VercelRequest, VercelResponse } from "@vercel/node";
import { loadSettings } from "../src/config.js";
import { buildInfoHtml } from "../src/donna/infoPage.js";

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const settings = await loadSettings();
  const html = buildInfoHtml(settings.dashboardConfig.navVisibility, settings.dashboardConfig.navOrder);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
}
