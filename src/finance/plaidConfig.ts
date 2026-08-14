// Split out from plaidClient.ts deliberately — this has zero dependency on
// the "plaid" package (a ~7.5MB SDK), unlike plaidClient.ts's
// getPlaidClient(). Pages that only need to know WHETHER Plaid is
// configured (Home, the Finances page's own GET/render path) should import
// this instead of plaidClient.ts, so a static `import` doesn't transitively
// load the whole SDK on every request to those pages — only code that
// actually calls the Plaid API needs plaidClient.ts, and it can import
// that lazily.
export function isPlaidConfigured(): boolean {
  return Boolean(process.env.PLAID_CLIENT_ID && process.env.PLAID_SECRET);
}
