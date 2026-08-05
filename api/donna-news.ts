import type { VercelRequest, VercelResponse } from "@vercel/node";
import { loadSettings } from "../src/config.js";
import { resolveTimezone, localDateKey } from "../src/util/time.js";
import { getDailyContext } from "../src/chat/dailyContext.js";
import { getNewslettersForDay } from "../src/gmail/index.js";
import { getCommunityFeedItems } from "../src/news/communityFeeds.js";
import { buildNewsHtml } from "../src/donna/newsPage.js";
import { requireAuth } from "../src/auth/session.js";
import { invalidateCache } from "../src/util/cache.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!(await requireAuth(req, res))) return;

  // Same 15-minute community-feed cache Home used to own — the Refresh
  // link on the Community sub-tab clears it so a new post shows up
  // immediately instead of waiting out the cache.
  if (req.query.refresh === "1") {
    await invalidateCache("community-feed-items");
  }

  const settings = await loadSettings();
  const timezone = resolveTimezone(settings.timezone);
  const day = localDateKey(new Date(), timezone);

  const [context, newsletters, communityFeedItems] = await Promise.all([
    getDailyContext(day),
    getNewslettersForDay(day).catch(() => []),
    getCommunityFeedItems().catch(() => []),
  ]);

  const highlight = typeof req.query.highlight === "string" ? req.query.highlight : null;

  const html = buildNewsHtml({
    context,
    newsletters,
    communityFeedItems,
    defaultNewsTab: settings.dashboardConfig.defaultNewsTab,
    highlight,
    navVisibility: settings.dashboardConfig.navVisibility,
    navOrder: settings.dashboardConfig.navOrder,
  });
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
}
