import type { VercelRequest, VercelResponse } from "@vercel/node";
import { loadSettings } from "../src/config.js";
import { getRecentIpoFilings } from "../src/ipos/store.js";
import { getFollowedCompanies, followCompany, unfollowCompany } from "../src/ipos/followedCompanies.js";
import { buildIposHtml } from "../src/donna/iposPage.js";
import { requireAuth } from "../src/auth/session.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!(await requireAuth(req, res))) return;

  if (req.method === "POST") {
    const body = (req.body ?? {}) as Record<string, string>;
    const action = body.action;

    try {
      if (action === "follow") {
        const cik = body.cik;
        const companyName = body.companyName;
        if (cik && companyName) {
          await followCompany(cik, companyName, body.ticker);
        }
      } else if (action === "unfollow") {
        const cik = body.cik;
        if (cik) {
          await unfollowCompany(cik);
        }
      }
      res.redirect(303, "/donna/ipos");
    } catch (err) {
      console.error("IPO follow action failed:", err);
      res.redirect(303, "/donna/ipos");
    }
    return;
  }

  const settings = await loadSettings();
  const [filings, followedCompanies] = await Promise.all([
    getRecentIpoFilings(20).catch(() => []),
    getFollowedCompanies().catch(() => []),
  ]);

  const html = buildIposHtml({
    filings,
    followedCompanies,
    navVisibility: settings.dashboardConfig.navVisibility,
    navOrder: settings.dashboardConfig.navOrder,
  });
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
}
