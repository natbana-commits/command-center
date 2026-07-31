import type { VercelRequest, VercelResponse } from "@vercel/node";
import { loadSettings } from "../src/config.js";
import { resolveTimezone, localDateKey } from "../src/util/time.js";
import { getDailyContext } from "../src/chat/dailyContext.js";
import { getNewslettersForDay } from "../src/gmail/index.js";
import { buildDonnaHtml } from "../src/donna/page.js";

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const settings = loadSettings();
  const timezone = resolveTimezone(settings.timezone);
  const day = localDateKey(new Date(), timezone);

  const [context, newsletters] = await Promise.all([
    getDailyContext(day),
    getNewslettersForDay(day),
  ]);

  const html = buildDonnaHtml(context, newsletters);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
}
