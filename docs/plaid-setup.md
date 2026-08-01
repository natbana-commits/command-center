# Finance dashboard (Plaid) + login gate setup

Two things need your own action before this is live: choosing the
dashboard's password, and creating a Plaid account. Everything else
(schema, pages, sync, webhook verification) is already built and
typechecked — this is the "credential/account setup only you can do"
half.

## 1. Pick the dashboard password

The whole `/donna/*` site is now behind a login page instead of relying
on Vercel's Deployment Protection toggle. Pick a real password (not the
`changeme-local-dev` placeholder currently in your local `.env`, which
only exists so local testing works) and a random session-signing secret:

```
DASHBOARD_PASSWORD=<a real password you'll remember>
SESSION_SECRET=<openssl rand -hex 32>
```

Run `openssl rand -hex 32` in a terminal to generate `SESSION_SECRET` —
it just needs to be long and random, you'll never type it in yourself.

## 2. Create a Plaid account

1. Go to https://dashboard.plaid.com/signup and sign up (free).
2. Once in the dashboard, go to **Team Settings → Keys**. You'll see a
   `client_id` and separate secrets per environment (Sandbox first,
   Production later once you're ready to link real accounts).
3. Copy the Sandbox values into your `.env`:
   ```
   PLAID_CLIENT_ID=...
   PLAID_SECRET=...        (the Sandbox secret)
   PLAID_ENV=sandbox
   ```
4. `FINANCE_ENCRYPTION_KEY` is already generated for local testing (in
   your local `.env`) — for Vercel, generate a separate one with
   `openssl rand -hex 32` and treat it like any other production secret
   (losing it makes previously-linked accounts' stored tokens
   undecryptable, so keep it somewhere durable, e.g. a password manager).

## 3. Try it in Sandbox first

With the Sandbox keys set, go to `/donna/finances` and click **"+ Link an
account"**. Plaid's Link widget will open — search for **"Platypus
Bank"** (or any Sandbox-listed institution) and use Plaid's documented
Sandbox test credentials (username `user_good`, password `pass_good` —
see https://plaid.com/docs/sandbox/test-credentials/ if those ever
change). This links a fake account with fake transactions, so you can
try linking, unlinking, and browsing the page with zero real financial
exposure before touching a real bank.

## 4. Register the webhook URL (for real-time updates)

1. Once deployed, your webhook URL is:
   `https://<your-vercel-domain>/api/plaid-webhook`
2. Set `PLAID_WEBHOOK_URL` to that exact URL in both your local `.env`
   and Vercel's env vars — the code passes it to Plaid every time a new
   account is linked (`/link/token/create`), so it just needs to be
   correct before you link an account, not registered anywhere separately
   in Plaid's dashboard.
3. You can trigger a test webhook delivery from Plaid's dashboard
   (**Sandbox → Webhooks**) once an account is linked, to confirm it
   reaches your deployment and updates the page without a manual refresh.

## 5. Go to production (once Sandbox testing looks right)

1. Back in Plaid's dashboard, request Production access (Team Settings →
   Keys → Production) — this requires a short questionnaire about your
   use case; approval is typically fast for personal/low-volume use.
2. Copy the Production `secret` (the `client_id` stays the same across
   environments) and update:
   ```
   PLAID_SECRET=...       (the Production secret)
   PLAID_ENV=production
   ```
3. Update `PLAID_WEBHOOK_URL` to your production domain if it differs
   from what you used in Sandbox.
4. Link your real Amex, Marcus, and PNC accounts the same way — "+ Link
   an account" on `/donna/finances`, in your own browser. Donna's code
   never sees your real bank password; Plaid Link talks to your bank
   directly and only hands back a token afterward.

**Note on Fidelity**: it isn't currently supported by Plaid (or, more
broadly, by any mainstream credential-based aggregator — Fidelity has
actively blocked third-party data access since 2024). You'll need to
keep checking that account separately; there's no dashboard workaround
for this one.

## 6. Add the secrets to Vercel

Once you're happy with local testing:
```
vercel env add DASHBOARD_PASSWORD production
vercel env add SESSION_SECRET production
vercel env add PLAID_CLIENT_ID production
vercel env add PLAID_SECRET production
vercel env add PLAID_ENV production
vercel env add PLAID_WEBHOOK_URL production
vercel env add FINANCE_ENCRYPTION_KEY production
```
(or paste them into the Vercel dashboard's Environment Variables screen —
same effect). Redeploy afterward so the running functions pick them up.
