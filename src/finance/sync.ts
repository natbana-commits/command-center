import type { AccountBase, Transaction } from "plaid";
import { getPlaidClient } from "./plaidClient.js";
import { getDecryptedAccessToken, getAllItems, updateCursor, setNeedsReauth } from "./items.js";
import { upsertAccounts } from "./accounts.js";
import { upsertTransactions, deleteTransactions } from "./transactionsStore.js";

// Plaid recommends personal_finance_category over the deprecated legacy
// `category` array, but sandbox/older items may only populate the latter —
// fall back to it (using the most specific, last entry) rather than
// showing no category at all.
function categoryLabel(t: Transaction): string | null {
  if (t.personal_finance_category?.primary) return t.personal_finance_category.primary;
  if (t.category && t.category.length > 0) return t.category[t.category.length - 1];
  return null;
}

export async function syncAccountsForItem(itemId: string): Promise<void> {
  const accessToken = await getDecryptedAccessToken(itemId);
  const client = getPlaidClient();
  const response = await client.accountsGet({ access_token: accessToken });

  await upsertAccounts(
    response.data.accounts.map((a: AccountBase) => ({
      accountId: a.account_id,
      itemId,
      name: a.name,
      officialName: a.official_name,
      type: a.type,
      subtype: a.subtype,
      mask: a.mask,
      currentBalance: a.balances.current,
      availableBalance: a.balances.available,
      isoCurrencyCode: a.balances.iso_currency_code,
    }))
  );
}

// Cursor-based incremental sync (Plaid's recommended pattern over
// re-fetching full transaction history each time) — paginates via
// has_more/next_cursor, persisting the cursor after every page so a
// crash mid-sync resumes rather than re-processing from scratch.
export async function syncTransactionsForItem(itemId: string): Promise<void> {
  const accessToken = await getDecryptedAccessToken(itemId);
  const client = getPlaidClient();

  const items = await getAllItems();
  let cursor = items.find((i) => i.itemId === itemId)?.cursor ?? undefined;

  let hasMore = true;
  while (hasMore) {
    const response = await client.transactionsSync({ access_token: accessToken, cursor });
    const { added, modified, removed, next_cursor, has_more } = response.data;

    await upsertTransactions(
      [...added, ...modified].map((t) => ({
        transactionId: t.transaction_id,
        accountId: t.account_id,
        amount: t.amount,
        isoCurrencyCode: t.iso_currency_code,
        name: t.name,
        merchantName: t.merchant_name ?? null,
        category: categoryLabel(t),
        pending: t.pending,
        transactionDate: t.date,
      }))
    );
    await deleteTransactions(removed.map((r) => r.transaction_id));

    cursor = next_cursor;
    hasMore = has_more;
    await updateCursor(itemId, cursor);
  }
}

// Used by the webhook receiver and by a manual "refresh" action — swallows
// per-item errors so one bad/expired Item doesn't block syncing the rest.
export async function syncAllItems(): Promise<void> {
  const items = await getAllItems();
  for (const item of items) {
    try {
      await syncAccountsForItem(item.itemId);
      await syncTransactionsForItem(item.itemId);
      if (item.needsReauth) await setNeedsReauth(item.itemId, false);
    } catch (err) {
      console.error(`Finance sync failed for item ${item.itemId}:`, err);
    }
  }
}
