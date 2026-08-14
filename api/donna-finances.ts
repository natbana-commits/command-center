import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Products, CountryCode } from "plaid";
import { loadSettings } from "../src/config.js";
import { requireAuth } from "../src/auth/session.js";
import { getPlaidClient, isPlaidConfigured } from "../src/finance/plaidClient.js";
import { getAllItems, getDecryptedAccessToken, saveItem, deleteItem, setNeedsReauth } from "../src/finance/items.js";
import { getAllAccounts } from "../src/finance/accounts.js";
import { getRecentTransactions, getTransactionsForAccount } from "../src/finance/transactionsStore.js";
import { syncAccountsForItem, syncTransactionsForItem } from "../src/finance/sync.js";
import { verifyPlaidWebhook } from "../src/finance/webhookVerify.js";
import { getNetWorthHistory, getAccountBalanceHistory, bucketBalancePoints, type BalanceGranularity } from "../src/finance/balanceHistory.js";
import { detectRecurringCharges } from "../src/finance/recurringCharges.js";
import { getRecurringChargeOverrides, applyRecurringChargeOverrides } from "../src/finance/recurringChargeOverrides.js";
import { getSpendingHistory, getSpendingByCategory, getSpendingHistoryForAccounts, getTopMerchants } from "../src/finance/spendingAnalytics.js";
import { getManualBills } from "../src/finance/manualBills.js";
import { buildUpcomingPayments } from "../src/finance/upcomingPayments.js";
import { resolveTimezone } from "../src/util/time.js";
import { buildFinancesHtml } from "../src/donna/financesPage.js";
import { computeFinanceAccountSummary } from "../src/donna/page.js";
import { getRecentIpoFilings } from "../src/ipos/store.js";
import { getFollowedCompanies, followCompany, unfollowCompany } from "../src/ipos/followedCompanies.js";
import { buildIposHtml } from "../src/donna/iposPage.js";

// Plaid's webhook signature covers the exact raw request bytes, and
// Vercel's automatic body parsing doesn't preserve those (re-serializing
// the parsed object isn't guaranteed byte-identical) — this route reads
// the body itself instead, both for verifying the webhook and for the
// in-app POST actions below.
export const config = { api: { bodyParser: false } };

async function readRawBody(req: VercelRequest): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : (chunk as Buffer));
  }
  return Buffer.concat(chunks).toString("utf8");
}

function parseBody(rawBody: string, contentType: string | undefined): Record<string, string> {
  if (contentType?.includes("application/json")) {
    return rawBody ? JSON.parse(rawBody) : {};
  }
  return Object.fromEntries(new URLSearchParams(rawBody));
}

interface PlaidWebhookPayload {
  webhook_type?: string;
  webhook_code?: string;
  item_id?: string;
  error?: { error_code?: string };
}

async function handlePlaidWebhook(payload: PlaidWebhookPayload): Promise<void> {
  if (!payload.item_id) return;

  if (payload.webhook_type === "TRANSACTIONS" && payload.webhook_code === "SYNC_UPDATES_AVAILABLE") {
    await syncTransactionsForItem(payload.item_id);
    return;
  }
  if (payload.webhook_type === "ITEM" && payload.error?.error_code === "ITEM_LOGIN_REQUIRED") {
    await setNeedsReauth(payload.item_id, true);
  }
  // Other webhook types/codes (e.g. WEBHOOK_UPDATE_ACKNOWLEDGED) need no action.
}

async function handleCreateLinkToken(res: VercelResponse) {
  const client = getPlaidClient();
  const response = await client.linkTokenCreate({
    user: { client_user_id: "nathan" },
    client_name: "Donna",
    products: [Products.Transactions],
    country_codes: [CountryCode.Us],
    language: "en",
    webhook: process.env.PLAID_WEBHOOK_URL || undefined,
    // Only OAuth institutions (most major banks, in production — sandbox
    // never exercises this) use this: Link redirects out to the bank's
    // real login page and back here, which Plaid only allows landing on a
    // URL registered in the dashboard as an Allowed redirect URI. Omitted
    // entirely when unset so non-OAuth institutions keep working exactly
    // as before — Plaid only requires this for the banks that need it.
    redirect_uri: process.env.PLAID_REDIRECT_URI || undefined,
  });
  res.status(200).json({ linkToken: response.data.link_token });
}

async function handleExchangePublicToken(body: Record<string, string>, res: VercelResponse) {
  const publicToken = body.publicToken;
  if (!publicToken) {
    res.status(400).json({ error: "Missing publicToken" });
    return;
  }
  const institutionName = body.institutionName?.trim() || "Linked account";

  const client = getPlaidClient();
  const exchange = await client.itemPublicTokenExchange({ public_token: publicToken });
  const { access_token: accessToken, item_id: itemId } = exchange.data;

  await saveItem(itemId, institutionName, accessToken);
  await syncAccountsForItem(itemId);
  await syncTransactionsForItem(itemId);

  res.status(200).json({ ok: true });
}

async function handleUnlink(body: Record<string, string>, res: VercelResponse) {
  const itemId = body.itemId;
  if (itemId) {
    try {
      const accessToken = await getDecryptedAccessToken(itemId);
      await getPlaidClient().itemRemove({ access_token: accessToken });
    } catch (err) {
      // Still remove it locally even if Plaid's side fails (e.g. the
      // Item was already revoked from the bank's side) — a stuck linked
      // account the user can't remove is worse than a slightly stale
      // Plaid-side record.
      console.error(`Plaid item/remove failed for ${itemId} (removing locally anyway):`, err);
    }
    await deleteItem(itemId);
  }
  res.redirect(303, "/donna/finances");
}

// Folded in here (rather than its own api/donna-ipos.ts) for the same
// Vercel Hobby 12-function reason as the other route merges — Finances and
// IPOs are both "watch a market thing" pages, and real traffic to either
// keeps both warm. Reuses this file's already-parsed POST body (see
// handler() below) rather than re-reading the request stream, which can
// only be consumed once.
async function handleIposPost(body: Record<string, string>, res: VercelResponse) {
  try {
    if (body.action === "follow") {
      const cik = body.cik;
      const companyName = body.companyName;
      if (cik && companyName) {
        await followCompany(cik, companyName, body.ticker);
      }
    } else if (body.action === "unfollow") {
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
}

async function handleIposGet(res: VercelResponse) {
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const plaidVerification = req.headers["plaid-verification"];

  if (req.method === "POST" && typeof plaidVerification === "string") {
    const rawBody = await readRawBody(req);
    const valid = await verifyPlaidWebhook(plaidVerification, rawBody);
    if (!valid) {
      res.status(401).send("Invalid signature");
      return;
    }
    try {
      await handlePlaidWebhook(JSON.parse(rawBody));
    } catch (err) {
      console.error("Plaid webhook handling failed:", err);
    }
    res.status(200).json({ acknowledged: true });
    return;
  }

  if (!(await requireAuth(req, res))) return;

  if (req.query.page === "ipos" && req.method !== "POST") {
    await handleIposGet(res);
    return;
  }

  // Backs the Home Finances widget's account picker — a small JSON
  // sidecar rather than a full page fetch, since switching accounts
  // there just needs one number and two short balance-history series.
  if (req.query.page === "account-summary" && req.method !== "POST") {
    const accountId = typeof req.query.accountId === "string" ? req.query.accountId : "";
    if (!accountId) {
      res.status(400).json({ error: "Missing accountId" });
      return;
    }
    const accounts = await getAllAccounts();
    const account = accounts.find((a) => a.accountId === accountId);
    if (!account) {
      res.status(404).json({ error: "Account not found" });
      return;
    }
    const [weekHistory, monthHistory, recentTransactions] = await Promise.all([
      getAccountBalanceHistory(accountId, 7).catch(() => []),
      getAccountBalanceHistory(accountId, 30).catch(() => []),
      getTransactionsForAccount(accountId, 2).catch(() => []),
    ]);
    res.status(200).json(computeFinanceAccountSummary(account, weekHistory, monthHistory, recentTransactions));
    return;
  }

  if (req.method === "POST") {
    const rawBody = await readRawBody(req);
    const body = parseBody(rawBody, req.headers["content-type"]);

    if (req.query.page === "ipos") {
      await handleIposPost(body, res);
      return;
    }

    try {
      if (body.action === "create-link-token") {
        await handleCreateLinkToken(res);
        return;
      }
      if (body.action === "exchange-public-token") {
        await handleExchangePublicToken(body, res);
        return;
      }
      if (body.action === "unlink") {
        await handleUnlink(body, res);
        return;
      }
      res.status(400).json({ error: "Unknown action" });
    } catch (err) {
      console.error("Finance action failed:", err);
      if (body.action === "unlink") {
        res.redirect(303, "/donna/finances?error=1");
      } else {
        res.status(500).json({ error: "Action failed" });
      }
    }
    return;
  }

  const plaidConfigured = isPlaidConfigured();

  // Account drill-down: bank accounts get recent transactions + balance,
  // investment accounts (type "investment" — Marcus, Fidelity, etc.) get a
  // balance-history graph instead, since "value over time" is the point
  // for those rather than a transaction feed. Short-circuits the rest of
  // the composite-view fetching below, which this doesn't need.
  if (plaidConfigured && typeof req.query.accountId === "string") {
    const accountId = req.query.accountId;
    const rawGranularity = typeof req.query.granularity === "string" ? req.query.granularity : "day";
    const granularity: BalanceGranularity =
      rawGranularity === "week" || rawGranularity === "month" || rawGranularity === "year" ? rawGranularity : "day";

    const accounts = await getAllAccounts();
    const account = accounts.find((a) => a.accountId === accountId);
    if (!account) {
      res.redirect(303, "/donna/finances");
      return;
    }

    const isInvestment = account.type === "investment";
    const [transactions, rawBalanceHistory] = await Promise.all([
      isInvestment ? Promise.resolve([]) : getTransactionsForAccount(accountId, 50).catch(() => []),
      isInvestment ? getAccountBalanceHistory(accountId).catch(() => []) : Promise.resolve([]),
    ]);

    const settings = await loadSettings();
    const html = buildFinancesHtml({
      plaidConfigured,
      timezone: resolveTimezone(settings.timezone),
      items: [],
      accounts: [],
      transactions: [],
      netWorthHistory: [],
      recurringCharges: [],
      upcomingPayments: [],
      spendingHistory: [],
      spendingByCategory: [],
      creditCardSpendingHistory: [],
      topMerchants: [],
      financeWidgets: settings.dashboardConfig.financeWidgets,
      navVisibility: settings.dashboardConfig.navVisibility,
      navOrder: settings.dashboardConfig.navOrder,
      selectedAccount: { account, transactions, balanceHistory: bucketBalancePoints(rawBalanceHistory, granularity), granularity },
    });
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(200).send(html);
    return;
  }

  const [settings, manualBills, recurringChargeOverrides] = await Promise.all([
    loadSettings(),
    getManualBills().catch(() => []),
    getRecurringChargeOverrides().catch(() => []),
  ]);
  const timezone = resolveTimezone(settings.timezone);
  const [items, accounts, transactions, netWorthHistory, recurringChargeTransactions] = plaidConfigured
    ? await Promise.all([
        getAllItems(),
        getAllAccounts(),
        getRecentTransactions(50),
        getNetWorthHistory().catch(() => []),
        // A separate, deeper pull than the 50 shown in "Recent Transactions" —
        // detecting a monthly pattern needs several months of history, not
        // just what's displayed.
        getRecentTransactions(300).catch(() => []),
      ])
    : [[], [], [], [], []];
  // Applied before this flows anywhere else — both the Recurring Charges
  // widget and buildUpcomingPayments below need a dismissed merchant to
  // already be gone, not just hidden in its own widget.
  const recurringCharges = applyRecurringChargeOverrides(detectRecurringCharges(recurringChargeTransactions), recurringChargeOverrides);
  const creditAccountIds = new Set(accounts.filter((a) => a.type === "credit").map((a) => a.accountId));

  const html = buildFinancesHtml({
    plaidConfigured,
    timezone,
    items,
    accounts,
    transactions,
    netWorthHistory,
    recurringCharges,
    upcomingPayments: buildUpcomingPayments(recurringCharges, manualBills, timezone),
    // Same 300-row pull already fetched above for recurring-charge
    // detection — plenty of history for both a 90-day spending trend and
    // a 30-day category breakdown without a second Supabase query.
    spendingHistory: getSpendingHistory(recurringChargeTransactions),
    spendingByCategory: getSpendingByCategory(recurringChargeTransactions),
    creditCardSpendingHistory: getSpendingHistoryForAccounts(recurringChargeTransactions, creditAccountIds),
    // Widget shows the top 8 by default and expands to the rest in place
    // on click — fetch enough here to make that expansion meaningful.
    topMerchants: getTopMerchants(recurringChargeTransactions, 30, 20),
    financeWidgets: settings.dashboardConfig.financeWidgets,
    navVisibility: settings.dashboardConfig.navVisibility,
    navOrder: settings.dashboardConfig.navOrder,
  });
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
}
