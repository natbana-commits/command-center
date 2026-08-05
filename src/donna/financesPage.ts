import type { NavVisibility, FinanceWidgetId } from "../config.js";
import type { PlaidItem } from "../finance/items.js";
import type { PlaidAccount } from "../finance/accounts.js";
import type { PlaidTransaction } from "../finance/transactionsStore.js";
import type { NetWorthPoint, BalancePoint, BalanceGranularity } from "../finance/balanceHistory.js";
import type { RecurringCharge } from "../finance/recurringCharges.js";
import type { SpendingPoint, CategorySpend, MerchantSpend } from "../finance/spendingAnalytics.js";
import type { UpcomingPayment } from "../finance/upcomingPayments.js";
import { escapeHtml } from "../util/html.js";
import { renderLayout } from "./layout.js";
import { renderLineChart, renderBarChart } from "./charts.js";
import { renderDayBadge } from "./dayBadge.js";
import { renderPageEditLink } from "./editLink.js";

const VISIBLE_TRANSACTIONS = 4;

// Widgets short enough to sit several-across in the masonry grid instead
// of each claiming a full-width row — desktop was scrolling much further
// than the content needed just from these being stacked one under
// another. List-heavy widgets (Accounts, Transactions) stay full-width; a
// 1/3-width column reads cramped for a long list of rows.
const COMPACT_WIDGET_IDS: readonly FinanceWidgetId[] = [
  "net-worth",
  "spending-over-time",
  "spending-by-category",
  "credit-card-spending",
  "top-merchants",
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
    <a class="finance-account-tile" href="/donna/finances?accountId=${encodeURIComponent(account.accountId)}">
      <div class="finance-row-icon" style="background:${avatarColor(account.name)};">${escapeHtml(avatarInitial(account.name))}</div>
      <div class="finance-account-tile-body">
        <div class="finance-row-title">${escapeHtml(account.name)}${escapeHtml(maskLabel)}</div>
        ${subtypeLabel ? `<div class="finance-row-meta">${escapeHtml(subtypeLabel)}</div>` : ""}
        <div class="finance-account-tile-amount">${escapeHtml(formatMoney(account.currentBalance, account.isoCurrencyCode))}</div>
      </div>
    </a>`;
}

function renderItemCard(item: PlaidItem, accounts: PlaidAccount[]): string {
  const reauthBadge = item.needsReauth
    ? `<span class="reminder-due reminder-due-overdue">Needs re-authentication</span>`
    : "";
  return `
    <div class="card fw-account-card">
      <div style="display:flex; align-items:center; justify-content:space-between; gap: var(--sp-2);">
        <h1 class="section-title" style="margin:0;">${escapeHtml(item.institutionName)}</h1>
        ${reauthBadge}
      </div>
      <div class="finance-account-grid">${accounts.map(renderAccountRow).join("\n")}</div>
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

function chartDateLabel(dateStr: string): string {
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function renderNetWorthSection(history: NetWorthPoint[]): string {
  if (history.length === 0) {
    return `<p class="empty">No history yet. Net worth is snapshotted once a day, so the chart fills in starting today.</p>`;
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
    ${renderLineChart(
      history.map((h) => ({ label: h.date, value: h.netWorth })),
      { showAxes: true, height: 240, formatValue: (v) => formatMoney(v, "USD"), formatLabel: chartDateLabel }
    )}`;
}

function renderSpendingHistorySection(history: SpendingPoint[]): string {
  if (history.length === 0) {
    return `<p class="empty">No spending yet in this window.</p>`;
  }
  const total = history.reduce((sum, p) => sum + p.amount, 0);
  return `
    <p style="font-size: 22px; font-weight: 600; margin: 0 0 4px;">${escapeHtml(formatMoney(total, "USD"))}</p>
    <p class="hint" style="margin: 0 0 12px;">Total spend over the last ${history.length > 1 ? "90 days" : "day"}</p>
    ${renderLineChart(
      history.map((h) => ({ label: h.date, value: h.amount })),
      { showAxes: true, height: 240, formatValue: (v) => formatMoney(v, "USD"), formatLabel: chartDateLabel }
    )}`;
}

function renderSpendingByCategorySection(categories: CategorySpend[]): string {
  if (categories.length === 0) {
    return `<p class="empty">No categorized spending yet in the last 30 days.</p>`;
  }
  const top = categories.slice(0, 8);
  return renderBarChart(
    top.map((c) => ({ label: c.category, value: c.amount })),
    { formatValue: (v) => formatMoney(v, "USD"), showAxes: true }
  );
}

function renderCreditCardSpendingSection(history: SpendingPoint[]): string {
  if (history.length === 0) {
    return `<p class="empty">No credit card spending yet in this window.</p>`;
  }
  const total = history.reduce((sum, p) => sum + p.amount, 0);
  return `
    <p style="font-size: 22px; font-weight: 600; margin: 0 0 4px;">${escapeHtml(formatMoney(total, "USD"))}</p>
    <p class="hint" style="margin: 0 0 12px;">Credit card spend over the last ${history.length > 1 ? "90 days" : "day"}</p>
    ${renderLineChart(
      history.map((h) => ({ label: h.date, value: h.amount })),
      { showAxes: true, height: 200, formatValue: (v) => formatMoney(v, "USD"), formatLabel: chartDateLabel }
    )}`;
}

function renderTopMerchantsSection(merchants: MerchantSpend[]): string {
  if (merchants.length === 0) {
    return `<p class="empty">No merchant spending yet in the last 30 days.</p>`;
  }
  return renderBarChart(
    merchants.map((m) => ({ label: m.merchant, value: m.amount })),
    { formatValue: (v) => formatMoney(v, "USD"), showAxes: true }
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

export interface AccountDetailData {
  account: PlaidAccount;
  transactions: PlaidTransaction[];
  balanceHistory: BalancePoint[];
  granularity: BalanceGranularity;
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
  creditCardSpendingHistory: SpendingPoint[];
  topMerchants: MerchantSpend[];
  financeWidgets: { id: FinanceWidgetId; visible: boolean }[];
  navVisibility: NavVisibility;
  navOrder: string[];
  selectedAccount?: AccountDetailData;
}

function renderGranularityToggle(accountId: string, active: BalanceGranularity): string {
  const options: { key: BalanceGranularity; label: string }[] = [
    { key: "day", label: "Day" },
    { key: "week", label: "Week" },
    { key: "month", label: "Month" },
    { key: "year", label: "Year" },
  ];
  return `
    <div class="home-tabs" style="margin:0;">
      ${options
        .map(
          (o) =>
            `<a class="home-tab-btn${o.key === active ? " home-tab-btn-active" : ""}" href="/donna/finances?accountId=${encodeURIComponent(accountId)}&granularity=${o.key}">${o.label}</a>`
        )
        .join("")}
    </div>`;
}

// Investment accounts (Marcus, Fidelity, etc.) show a balance-history graph
// with a day/week/month/year granularity toggle — that's the meaningful
// view for an account whose point is its value over time. Bank accounts
// (depository/credit) show recent transactions + balance instead — the
// composite view up top still covers everyone at once.
function renderAccountDetail(detail: AccountDetailData): string {
  const { account, transactions, balanceHistory, granularity } = detail;
  const isInvestment = account.type === "investment";
  const maskLabel = account.mask ? ` ••${account.mask}` : "";
  const subtitleParts = [account.subtype ?? account.type, account.officialName && account.officialName !== account.name ? account.officialName : null].filter(
    Boolean
  );

  const balanceCard = `
    <div class="card" style="margin-bottom: var(--sp-3);">
      <div class="card-title">Balance</div>
      <p style="font-size: 22px; font-weight: 600; margin: 4px 0 0;">${escapeHtml(formatMoney(account.currentBalance, account.isoCurrencyCode))}</p>
    </div>`;

  const investmentSection = isInvestment
    ? `
    <div class="section" style="margin-top: var(--sp-3);">
      <div style="display:flex; align-items:center; justify-content:space-between; gap: var(--sp-2); flex-wrap: wrap;">
        <h1 class="section-title" style="margin:0;">Balance History</h1>
        ${renderGranularityToggle(account.accountId, granularity)}
      </div>
      <div class="card">
        ${
          balanceHistory.length <= 1
            ? // A single point renders as one bare, unlabeled dot with nothing
              // around it to explain what it is — reads as broken rather than
              // "there's only one snapshot so far," so it gets the same
              // explanatory empty-state as zero points instead of the chart.
              `<p class="empty">${balanceHistory.length === 1 ? `Only one snapshot so far (today, ${escapeHtml(formatMoney(balanceHistory[0].balance, account.isoCurrencyCode))}). The trend will start showing once a few more days are recorded.` : "No history yet. Balances are snapshotted once a day, so the chart fills in starting today."}</p>`
            : renderLineChart(balanceHistory.map((p) => ({ label: p.date, value: p.balance })))
        }
      </div>
    </div>`
    : "";

  const transactionsSection = !isInvestment
    ? `
    <div class="section" style="margin-top: var(--sp-3);">
      <h1 class="section-title">Recent Transactions</h1>
      <div class="card">${renderTransactionsList(transactions, new Map([[account.accountId, account.name]]))}</div>
    </div>`
    : "";

  return `
    <div class="section">
      <a class="hint" href="/donna/finances">← All accounts</a>
      <h1 class="page-title" style="margin-top: 8px;">${escapeHtml(account.name)}${escapeHtml(maskLabel)}</h1>
      ${subtitleParts.length > 0 ? `<p class="page-sub">${escapeHtml(subtitleParts.join(" · "))}</p>` : ""}
    </div>
    ${balanceCard}
    ${investmentSection}
    ${transactionsSection}`;
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
    creditCardSpendingHistory,
    topMerchants,
    financeWidgets,
    navVisibility,
    navOrder,
    selectedAccount,
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

  const sectionsById: Record<FinanceWidgetId, { title: string; content: string; editAnchor?: string } | null> = {
    "net-worth": accounts.length === 0 ? null : { title: "Net Worth", content: renderNetWorthSection(netWorthHistory) },
    "spending-over-time": accounts.length === 0 ? null : { title: "Spending Over Time", content: renderSpendingHistorySection(spendingHistory) },
    "spending-by-category": accounts.length === 0 ? null : { title: "Spending by Category", content: renderSpendingByCategorySection(spendingByCategory) },
    "credit-card-spending":
      accounts.filter((a) => a.type === "credit").length === 0
        ? null
        : { title: "Credit Card Spending", content: renderCreditCardSpendingSection(creditCardSpendingHistory) },
    "top-merchants": accounts.length === 0 ? null : { title: "Top Merchants", content: renderTopMerchantsSection(topMerchants) },
    accounts: {
      title: "Accounts",
      content: `${summaryCard}${
        items.length === 0
          ? `<p class="empty">No accounts linked yet.</p>`
          : `<div class="fw-masonry" id="fw-accounts-grid">${items.map((item) => renderItemCard(item, accountsByItem.get(item.itemId) ?? [])).join("\n")}</div>`
      }`,
    },
    "recurring-charges":
      recurringCharges.length === 0
        ? null
        : {
            title: "Recurring Charges",
            content: recurringCharges.map(renderRecurringChargeRow).join("\n"),
            editAnchor: "settings-recurring-charges",
          },
    "upcoming-payments":
      upcomingPayments.length === 0
        ? null
        : {
            title: "Upcoming Payments",
            content: upcomingPayments.map(renderUpcomingPaymentRow).join("\n"),
            editAnchor: "settings-manual-bills",
          },
    transactions: {
      title: "Recent Transactions",
      content: renderTransactionsList(transactions, accountNameById),
    },
  };

  const visibleWidgets = financeWidgets.filter((w) => w.visible && sectionsById[w.id]);
  const isCompact = (id: FinanceWidgetId) => (COMPACT_WIDGET_IDS as readonly string[]).includes(id);

  // Every compact widget renders together as one grid, always first,
  // regardless of where a full-width widget (Accounts, Transactions)
  // falls in the configured order — previously grouping only batched
  // *consecutive* compact widgets, so Accounts sitting in the middle of
  // the default order split them into two separate rows.
  const compactSections = visibleWidgets.filter((w) => isCompact(w.id)).map((w) => ({ id: w.id, ...sectionsById[w.id]! }));
  const fullWidthSections = visibleWidgets.filter((w) => !isCompact(w.id)).map((w) => ({ id: w.id, ...sectionsById[w.id]! }));

  // Masonry (shortest-column JS packing, client script below) rather than
  // a fixed CSS grid — which widgets are visible/how many is entirely up
  // to Settings, so no fixed column/span math can guarantee a gap-free
  // fill for every combination. Net Worth and Spending Over Time get
  // their "priority" from a taller chart (see renderNetWorthSection/
  // renderSpendingHistorySection), not a wider tile, so masonry packing
  // by height alone is all this needs.
  const compactGridHtml =
    compactSections.length === 0
      ? ""
      : `<div class="fw-masonry" id="fw-grid" style="margin-top: var(--sp-3);">
      ${compactSections
        .map(
          (section) =>
            `<div class="fw-tile">
              <div class="card-title" style="margin-bottom: var(--sp-2); display:flex; align-items:center; justify-content:space-between; gap:8px;">
                <span>${escapeHtml(section.title)}</span>
                ${section.editAnchor ? renderPageEditLink(section.editAnchor, section.title) : ""}
              </div>
              ${section.content}
            </div>`
        )
        .join("\n")}
    </div>`;

  const fullWidthHtml = fullWidthSections
    .map((section) => {
      // Accounts (the summary cards + item cards) already renders its own
      // .card elements, unlike the other full-width widgets, which need
      // one wrapped around their content — matching each section's prior
      // markup.
      const wrapped = section.id === "accounts" ? section.content : `<div class="card">${section.content}</div>`;
      return `<div class="section" style="margin-top: var(--sp-3);">
        <h1 class="section-title">${escapeHtml(section.title)}</h1>
        ${wrapped}
      </div>`;
    })
    .join("\n");

  const widgetSections = compactGridHtml + fullWidthHtml;

  const body = !plaidConfigured
    ? `
    <div class="section">
      <h1 class="page-title">Finances</h1>
      <p class="page-sub">Not set up yet</p>
    </div>
    <p class="empty">Finance linking needs Plaid API credentials set up first. See Settings' "How this works" section for details.</p>`
    : selectedAccount
      ? renderAccountDetail(selectedAccount)
      : `
    <div class="section">
      <h1 class="page-title">Finances</h1>
      <p class="page-sub">${items.length} institution${items.length === 1 ? "" : "s"} linked</p>
      ${renderPageEditLink("settings-manual-bills", "Bills")}
    </div>

    <button type="button" class="btn" id="link-account-btn" onclick="openPlaidLink()">+ Link an account</button>

    ${widgetSections}`;

  return renderLayout({
    title: "Donna · Finances",
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
      alert("Couldn't start linking an account. Try again in a bit.");
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

  // Greedy shortest-column packing — a plain flex-wrap left uneven gaps
  // whenever tiles/cards varied in height (a bank with 4 accounts next to
  // one with 1, or 5 widgets not dividing evenly into a row), so each
  // item goes into whichever column currently has the least total height
  // instead. Re-queries fresh from the container every run (not just
  // "whatever's currently in a column"), so it's safe to call again on
  // resize or after content changes.
  function distributeMasonry(containerId, itemSelector, columnCountRaw) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const items = Array.prototype.slice.call(container.querySelectorAll(itemSelector));
    if (items.length === 0) return;

    // Always wrapped in at least one .fw-masonry-col, even at 1 column —
    // keeps the CSS simple (.fw-masonry is always a row of columns, each
    // column always stacks its own items) instead of needing a second
    // "no columns at all" layout mode.
    const columnCount = Math.max(1, columnCountRaw);
    const columns = [];
    for (let i = 0; i < columnCount; i++) {
      const col = document.createElement("div");
      col.className = "fw-masonry-col";
      columns.push(col);
    }
    container.innerHTML = "";
    columns.forEach(function (col) { container.appendChild(col); });

    const heights = new Array(columnCount).fill(0);
    items.forEach(function (item) {
      let shortest = 0;
      for (let i = 1; i < columnCount; i++) {
        if (heights[i] < heights[shortest]) shortest = i;
      }
      columns[shortest].appendChild(item);
      heights[shortest] += item.offsetHeight;
    });
  }

  function distributeFinanceMasonry() {
    const wide = window.innerWidth;
    distributeMasonry("fw-grid", ".fw-tile", wide > 1100 ? 3 : wide > 700 ? 2 : 1);
    distributeMasonry("fw-accounts-grid", ".fw-account-card", wide > 860 ? 3 : 1);
  }
  distributeFinanceMasonry();
  if (!window.__financeMasonryResizeBound) {
    window.__financeMasonryResizeBound = true;
    let resizeTimer;
    window.addEventListener("resize", function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(distributeFinanceMasonry, 150);
    });
  }
`;
