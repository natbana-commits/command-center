import type { NavVisibility, FinanceWidgetId } from "../config.js";
import type { PlaidItem } from "../finance/items.js";
import type { PlaidAccount } from "../finance/accounts.js";
import type { PlaidTransaction } from "../finance/transactionsStore.js";
import type { NetWorthPoint } from "../finance/balanceHistory.js";
import type { RecurringCharge } from "../finance/recurringCharges.js";
import type { SpendingPoint, CategorySpend } from "../finance/spendingAnalytics.js";
import type { UpcomingPayment } from "../finance/upcomingPayments.js";
import { escapeHtml } from "../util/html.js";
import { renderLayout } from "./layout.js";
import { renderLineChart, renderBarChart } from "./charts.js";
import { renderDayBadge } from "./dayBadge.js";
import { renderPageEditLink } from "./editLink.js";

const VISIBLE_TRANSACTIONS = 4;

// Widgets short enough to sit three-across in a .card-row instead of each
// claiming a full-width row — desktop was scrolling much further than the
// content needed just from these being stacked one under another. List-
// heavy widgets (Accounts, Transactions) stay full-width; a 1/3-width
// column reads cramped for a long list of rows.
const COMPACT_WIDGET_IDS: readonly FinanceWidgetId[] = [
  "net-worth",
  "spending-over-time",
  "spending-by-category",
  "recurring-charges",
  "upcoming-payments",
];

function formatMoney(amount: number | null, currency: string | null): string {
  if (amount === null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency ?? "USD",
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatTransactionDate(dateStr: string): string {
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// A small fixed palette for the row-icon "avatar" badges (accounts,
// merchants) — picked by a stable hash of the name so the same
// account/merchant always gets the same color across renders, purely a
// visual differentiator rather than meaningful categorization (unlike the
// econ-events category colors, which are keyed to a real fixed category).
const AVATAR_COLORS = ["#b86b45", "#4f7cac", "#6a8f5c", "#8a6bb8", "#c9a227", "#c1485c"];
function avatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}
function avatarInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "?";
}

function renderAccountRow(account: PlaidAccount): string {
  const subtypeLabel = account.subtype ? `${account.subtype}` : "";
  const maskLabel = account.mask ? ` ••${account.mask}` : "";
  return `
    <div class="finance-row">
      <div class="finance-row-icon" style="background:${avatarColor(account.name)};">${escapeHtml(avatarInitial(account.name))}</div>
      <div class="finance-row-body">
        <div class="finance-row-title">${escapeHtml(account.name)}${escapeHtml(maskLabel)}</div>
        ${subtypeLabel ? `<div class="finance-row-meta">${escapeHtml(subtypeLabel)}</div>` : ""}
      </div>
      <div class="finance-row-amount">${escapeHtml(formatMoney(account.currentBalance, account.isoCurrencyCode))}</div>
    </div>`;
}

function renderItemCard(item: PlaidItem, accounts: PlaidAccount[]): string {
  const reauthBadge = item.needsReauth
    ? `<span class="reminder-due reminder-due-overdue">Needs re-authentication</span>`
    : "";
  return `
    <div class="card" style="margin-bottom: var(--sp-3);">
      <div style="display:flex; align-items:center; justify-content:space-between; gap: var(--sp-2);">
        <h1 class="section-title" style="margin:0;">${escapeHtml(item.institutionName)}</h1>
        ${reauthBadge}
      </div>
      ${accounts.map(renderAccountRow).join("\n")}
      <form method="POST" action="/donna/finances" style="margin-top: var(--sp-2);" onsubmit="return confirm('Unlink ${escapeHtml(item.institutionName)}? This removes its accounts and transaction history from Donna.');">
        <input type="hidden" name="action" value="unlink" />
        <input type="hidden" name="itemId" value="${escapeHtml(item.itemId)}" />
        <button type="submit" class="btn btn-danger btn-small">Unlink</button>
      </form>
    </div>`;
}

function renderTransactionRow(t: PlaidTransaction, accountName: string): string {
  // Plaid convention: positive amount = money out, negative = money in
  // (refunds, direct deposits) — shown here as a "+" inflow instead of a
  // literal negative sign, which would read backwards to a user.
  const isInflow = t.amount < 0;
  const displayAmount = isInflow ? `+${formatMoney(-t.amount, t.isoCurrencyCode)}` : formatMoney(t.amount, t.isoCurrencyCode);
  const merchant = t.merchantName ?? t.name;
  const metaParts = [accountName, t.pending ? "pending" : "", t.category ?? ""].filter(Boolean);
  return `
    <div class="finance-row">
      <div class="finance-row-icon" style="background:${avatarColor(merchant)};">${escapeHtml(avatarInitial(merchant))}</div>
      <div class="finance-row-body">
        <div class="finance-row-title">${escapeHtml(merchant)}</div>
        <div class="finance-row-meta">${escapeHtml(metaParts.join(" · "))}</div>
      </div>
      <div class="finance-row-amount${isInflow ? " finance-row-amount-inflow" : ""}">
        ${escapeHtml(displayAmount)}
        <span class="finance-row-date">${escapeHtml(formatTransactionDate(t.transactionDate))}</span>
      </div>
    </div>`;
}

function renderTransactionsList(transactions: PlaidTransaction[], accountNameById: Map<string, string>): string {
  if (transactions.length === 0) return `<p class="empty">No transactions yet.</p>`;

  const rowHtml = (t: PlaidTransaction) => renderTransactionRow(t, accountNameById.get(t.accountId) ?? "Account");
  const visible = transactions.slice(0, VISIBLE_TRANSACTIONS);
  const rest = transactions.slice(VISIBLE_TRANSACTIONS);
  if (rest.length === 0) return visible.map(rowHtml).join("\n");

  return `
    ${visible.map(rowHtml).join("\n")}
    <div id="finance-extra-transactions" style="display:none;">${rest.map(rowHtml).join("\n")}</div>
    <button type="button" class="btn-secondary btn-small" style="margin-top: var(--sp-2);" onclick="toggleExtraTransactions(this)">Show ${rest.length} more</button>`;
}

function renderNetWorthSection(history: NetWorthPoint[]): string {
  if (history.length === 0) {
    return `<p class="empty">No history yet — net worth is snapshotted once a day, so the chart fills in starting today.</p>`;
  }

  const latest = history[history.length - 1];
  const first = history[0];
  const change = latest.netWorth - first.netWorth;
  const changeLabel =
    history.length > 1
      ? `${change >= 0 ? "+" : ""}${formatMoney(change, "USD")} since ${formatTransactionDate(first.date)}`
      : "";

  return `
    <p style="font-size: 22px; font-weight: 600; margin: 0 0 4px;">${escapeHtml(formatMoney(latest.netWorth, "USD"))}</p>
    ${changeLabel ? `<p class="hint" style="margin: 0 0 12px;">${escapeHtml(changeLabel)}</p>` : ""}
    ${renderLineChart(history.map((h) => ({ label: h.date, value: h.netWorth })))}`;
}

function renderSpendingHistorySection(history: SpendingPoint[]): string {
  if (history.length === 0) {
    return `<p class="empty">No spending yet in this window.</p>`;
  }
  const total = history.reduce((sum, p) => sum + p.amount, 0);
  return `
    <p style="font-size: 22px; font-weight: 600; margin: 0 0 4px;">${escapeHtml(formatMoney(total, "USD"))}</p>
    <p class="hint" style="margin: 0 0 12px;">Total spend over the last ${history.length > 1 ? "90 days" : "day"}</p>
    ${renderLineChart(history.map((h) => ({ label: h.date, value: h.amount })))}`;
}

function renderSpendingByCategorySection(categories: CategorySpend[]): string {
  if (categories.length === 0) {
    return `<p class="empty">No categorized spending yet in the last 30 days.</p>`;
  }
  const top = categories.slice(0, 8);
  return renderBarChart(
    top.map((c) => ({ label: c.category, value: c.amount })),
    { formatValue: (v) => formatMoney(v, "USD") }
  );
}

function renderRecurringChargeRow(charge: RecurringCharge): string {
  return `
    <div class="finance-row">
      <div class="finance-row-icon" style="background:${avatarColor(charge.label)};">${escapeHtml(avatarInitial(charge.label))}</div>
      <div class="finance-row-body">
        <div class="finance-row-title">${escapeHtml(charge.label)}</div>
        <div class="finance-row-meta">${charge.occurrences} charges · last ${escapeHtml(formatTransactionDate(charge.lastChargeDate))}</div>
      </div>
      <div class="finance-row-amount">${escapeHtml(formatMoney(charge.averageAmount, "USD"))}/mo</div>
    </div>`;
}

function renderUpcomingPaymentRow(payment: UpcomingPayment): string {
  const color = payment.source === "manual" ? "var(--olive)" : "var(--accent)";
  return `
    <div class="day-badge-row">
      ${renderDayBadge(payment.dueDate, color)}
      <div class="day-badge-body">
        <div class="day-badge-title">${escapeHtml(payment.label)}</div>
        <span class="hint" style="margin:0;">${escapeHtml(formatMoney(payment.amount, "USD"))}${payment.source === "manual" ? " · manual" : ""}</span>
      </div>
    </div>`;
}

export interface FinancesPageData {
  plaidConfigured: boolean;
  items: PlaidItem[];
  accounts: PlaidAccount[];
  transactions: PlaidTransaction[];
  netWorthHistory: NetWorthPoint[];
  recurringCharges: RecurringCharge[];
  upcomingPayments: UpcomingPayment[];
  spendingHistory: SpendingPoint[];
  spendingByCategory: CategorySpend[];
  financeWidgets: { id: FinanceWidgetId; visible: boolean }[];
  navVisibility: NavVisibility;
  navOrder: string[];
}

export function buildFinancesHtml(data: FinancesPageData): string {
  const {
    plaidConfigured,
    items,
    accounts,
    transactions,
    netWorthHistory,
    recurringCharges,
    upcomingPayments,
    spendingHistory,
    spendingByCategory,
    financeWidgets,
    navVisibility,
    navOrder,
  } = data;

  const accountsByItem = new Map<string, PlaidAccount[]>();
  for (const account of accounts) {
    const list = accountsByItem.get(account.itemId) ?? [];
    list.push(account);
    accountsByItem.set(account.itemId, list);
  }
  const accountNameById = new Map(accounts.map((a) => [a.accountId, a.name]));

  const totalCash = accounts
    .filter((a) => a.type === "depository")
    .reduce((sum, a) => sum + (a.currentBalance ?? 0), 0);
  const totalCredit = accounts
    .filter((a) => a.type === "credit")
    .reduce((sum, a) => sum + (a.currentBalance ?? 0), 0);

  const summaryCard =
    accounts.length === 0
      ? ""
      : `
    <div class="card-row" style="margin-bottom: var(--sp-3);">
      <div class="card">
        <div class="card-title">Total Cash</div>
        <p style="font-size: 22px; font-weight: 600; margin: 4px 0 0;">${escapeHtml(formatMoney(totalCash, "USD"))}</p>
      </div>
      ${
        totalCredit !== 0
          ? `<div class="card">
        <div class="card-title">Credit Card Balances</div>
        <p style="font-size: 22px; font-weight: 600; margin: 4px 0 0;">${escapeHtml(formatMoney(totalCredit, "USD"))}</p>
      </div>`
          : ""
      }
    </div>`;

  const sectionsById: Record<FinanceWidgetId, { title: string; content: string } | null> = {
    "net-worth": accounts.length === 0 ? null : { title: "Net Worth", content: renderNetWorthSection(netWorthHistory) },
    "spending-over-time": accounts.length === 0 ? null : { title: "Spending Over Time", content: renderSpendingHistorySection(spendingHistory) },
    "spending-by-category": accounts.length === 0 ? null : { title: "Spending by Category", content: renderSpendingByCategorySection(spendingByCategory) },
    accounts: {
      title: "Accounts",
      content: `${summaryCard}${
        items.length === 0
          ? `<p class="empty">No accounts linked yet.</p>`
          : items.map((item) => renderItemCard(item, accountsByItem.get(item.itemId) ?? [])).join("\n")
      }`,
    },
    "recurring-charges":
      recurringCharges.length === 0
        ? null
        : { title: "Recurring Charges", content: recurringCharges.map(renderRecurringChargeRow).join("\n") },
    "upcoming-payments":
      upcomingPayments.length === 0
        ? null
        : { title: "Upcoming Payments", content: upcomingPayments.map(renderUpcomingPaymentRow).join("\n") },
    transactions: {
      title: "Recent Transactions",
      content: renderTransactionsList(transactions, accountNameById),
    },
  };

  const visibleWidgets = financeWidgets.filter((w) => w.visible && sectionsById[w.id]);
  const isCompact = (id: FinanceWidgetId) => (COMPACT_WIDGET_IDS as readonly string[]).includes(id);

  const blocks: string[] = [];
  let compactRun: { title: string; content: string }[] = [];
  const flushCompactRun = () => {
    if (compactRun.length === 0) return;
    blocks.push(
      `<div class="card-row" style="margin-top: var(--sp-3);">
        ${compactRun
          .map(
            (section) =>
              `<div class="card">
                <div class="card-title" style="margin-bottom: var(--sp-2);">${escapeHtml(section.title)}</div>
                ${section.content}
              </div>`
          )
          .join("\n")}
      </div>`
    );
    compactRun = [];
  };

  for (const w of visibleWidgets) {
    const section = sectionsById[w.id]!;
    if (isCompact(w.id)) {
      compactRun.push(section);
      continue;
    }
    flushCompactRun();
    // Accounts (the summary cards + item cards) already renders its own
    // .card elements, unlike the other full-width widgets, which need one
    // wrapped around their content — matching each section's prior markup.
    const wrapped = w.id === "accounts" ? section.content : `<div class="card">${section.content}</div>`;
    blocks.push(
      `<div class="section" style="margin-top: var(--sp-3);">
        <h1 class="section-title">${escapeHtml(section.title)}</h1>
        ${wrapped}
      </div>`
    );
  }
  flushCompactRun();
  const widgetSections = blocks.join("\n");

  const body = !plaidConfigured
    ? `
    <div class="section">
      <h1 class="page-title">Finances</h1>
      <p class="page-sub">Not set up yet</p>
    </div>
    <p class="empty">Finance linking needs Plaid API credentials set up first — see the Info page for details.</p>`
    : `
    <div class="section">
      <h1 class="page-title">Finances</h1>
      <p class="page-sub">${items.length} institution${items.length === 1 ? "" : "s"} linked</p>
      ${renderPageEditLink("settings-manual-bills", "Bills")}
    </div>

    <button type="button" class="btn" id="link-account-btn" onclick="openPlaidLink()">+ Link an account</button>

    ${widgetSections}`;

  return renderLayout({
    title: "Donna — Finances",
    activeTab: "finances",
    bodyHtml: body,
    showChatFab: true,
    navVisibility,
    navOrder,
    pageScript: plaidConfigured ? CLIENT_SCRIPT : "",
    extraBodyHtml: plaidConfigured ? `<script src="https://cdn.plaid.com/link/v2/stable/link-initialize.js"></script>` : "",
  });
}

const CLIENT_SCRIPT = `
  function toggleExtraTransactions(btn) {
    const extra = document.getElementById("finance-extra-transactions");
    if (!extra) return;
    const showing = extra.style.display !== "none";
    extra.style.display = showing ? "none" : "block";
    btn.textContent = showing ? "Show " + extra.children.length + " more" : "Show less";
  }

  // Some institutions (most major banks, once PLAID_REDIRECT_URI is set)
  // require an OAuth handshake: Link redirects the whole tab out to the
  // bank's real login page, then back to this same URL with an
  // oauth_state_id param — a real navigation, so nothing in JS memory
  // survives it. The link token has to make the trip via sessionStorage
  // instead, and gets resumed automatically below on the page load that
  // comes back from the bank.
  var PLAID_TOKEN_KEY = "donna-plaid-link-token";

  async function finishExchange(publicToken, institutionName) {
    try {
      await fetch("/donna/finances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "exchange-public-token", publicToken: publicToken, institutionName: institutionName }),
      });
    } finally {
      try { sessionStorage.removeItem(PLAID_TOKEN_KEY); } catch (e) {}
      // Not reload() — an OAuth resume leaves ?oauth_state_id=... in the
      // URL, and reload() would keep it, re-triggering the resume check
      // below against a token that's already been used and cleared.
      window.location.href = "/donna/finances";
    }
  }

  function openHandler(token, btn, receivedRedirectUri) {
    return Plaid.create({
      token: token,
      receivedRedirectUri: receivedRedirectUri,
      onSuccess: function (publicToken, metadata) {
        btn.textContent = "Linking…";
        finishExchange(publicToken, (metadata && metadata.institution && metadata.institution.name) || "Linked account");
      },
      onExit: function () {
        try { sessionStorage.removeItem(PLAID_TOKEN_KEY); } catch (e) {}
        btn.disabled = false;
        btn.textContent = "+ Link an account";
      },
    });
  }

  async function openPlaidLink() {
    const btn = document.getElementById("link-account-btn");
    if (!btn) return;
    btn.disabled = true;
    btn.textContent = "Loading…";

    try {
      const res = await fetch("/donna/finances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create-link-token" }),
      });
      const data = await res.json();
      if (!data.linkToken) throw new Error("No link token returned");
      try { sessionStorage.setItem(PLAID_TOKEN_KEY, data.linkToken); } catch (e) {}
      openHandler(data.linkToken, btn, undefined).open();
    } catch (err) {
      btn.disabled = false;
      btn.textContent = "+ Link an account";
      alert("Couldn't start linking an account — try again in a bit.");
    }
  }

  (function () {
    if (window.location.search.indexOf("oauth_state_id=") === -1) return;
    const btn = document.getElementById("link-account-btn");
    let token = null;
    try { token = sessionStorage.getItem(PLAID_TOKEN_KEY); } catch (e) {}
    if (!btn || !token) return;
    btn.disabled = true;
    btn.textContent = "Linking…";
    openHandler(token, btn, window.location.href).open();
  })();
`;
