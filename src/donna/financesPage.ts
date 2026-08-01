import type { NavVisibility } from "../config.js";
import type { PlaidItem } from "../finance/items.js";
import type { PlaidAccount } from "../finance/accounts.js";
import type { PlaidTransaction } from "../finance/transactionsStore.js";
import { escapeHtml } from "../util/html.js";
import { renderLayout } from "./layout.js";

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

function renderAccountRow(account: PlaidAccount): string {
  const subtypeLabel = account.subtype ? ` · ${account.subtype}` : "";
  const maskLabel = account.mask ? ` ••${account.mask}` : "";
  return `
    <div class="agenda-event-row">
      <div class="agenda-event-title">${escapeHtml(account.name)}${escapeHtml(maskLabel)}<span class="hint">${escapeHtml(subtypeLabel)}</span></div>
      <div class="agenda-event-time">${escapeHtml(formatMoney(account.currentBalance, account.isoCurrencyCode))}</div>
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
  return `
    <div class="agenda-event-row">
      <div class="agenda-event-title">
        ${escapeHtml(t.merchantName ?? t.name)}
        <span class="hint">${escapeHtml(accountName)}${t.pending ? " · pending" : ""}${t.category ? ` · ${escapeHtml(t.category)}` : ""}</span>
      </div>
      <div class="agenda-event-time" style="${isInflow ? "color: var(--accent);" : ""}">${escapeHtml(displayAmount)} · ${escapeHtml(formatTransactionDate(t.transactionDate))}</div>
    </div>`;
}

export interface FinancesPageData {
  plaidConfigured: boolean;
  items: PlaidItem[];
  accounts: PlaidAccount[];
  transactions: PlaidTransaction[];
  navVisibility: NavVisibility;
  navOrder: string[];
}

export function buildFinancesHtml(data: FinancesPageData): string {
  const { plaidConfigured, items, accounts, transactions, navVisibility, navOrder } = data;

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
    </div>

    <button type="button" class="btn" id="link-account-btn" onclick="openPlaidLink()">+ Link an account</button>

    <div class="section" style="margin-top: var(--sp-3);">
      ${summaryCard}
      ${
        items.length === 0
          ? `<p class="empty">No accounts linked yet.</p>`
          : items.map((item) => renderItemCard(item, accountsByItem.get(item.itemId) ?? [])).join("\n")
      }
    </div>

    <div class="section" style="margin-top: var(--sp-3);">
      <h1 class="section-title">Recent Transactions</h1>
      <div class="card">
        ${
          transactions.length === 0
            ? `<p class="empty">No transactions yet.</p>`
            : transactions
                .map((t) => renderTransactionRow(t, accountNameById.get(t.accountId) ?? "Account"))
                .join("\n")
        }
      </div>
    </div>`;

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

      const handler = Plaid.create({
        token: data.linkToken,
        onSuccess: async (publicToken, metadata) => {
          btn.textContent = "Linking…";
          try {
            await fetch("/donna/finances", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "exchange-public-token",
                publicToken,
                institutionName: (metadata && metadata.institution && metadata.institution.name) || "Linked account",
              }),
            });
          } finally {
            window.location.reload();
          }
        },
        onExit: () => {
          btn.disabled = false;
          btn.textContent = "+ Link an account";
        },
      });
      handler.open();
    } catch (err) {
      btn.disabled = false;
      btn.textContent = "+ Link an account";
      alert("Couldn't start linking an account — try again in a bit.");
    }
  }
`;
