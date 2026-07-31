# Gmail newsletter setup

The newsletter feature is fully coded but stays inactive (no-ops silently)
until you complete this setup and add three secrets. Nothing here touches
the working parts of the brief — the code checks for these values and skips
the whole feature if they're missing.

## Before you start: check the Princeton account restriction

Sign in to https://console.cloud.google.com with your **personal** Google
account (not Princeton) for the steps below — Princeton's account only needs
to be used at the very last step, to grant consent. If Princeton's Workspace
admin blocks third-party OAuth apps, you'll find out at that step: Google
will show `Error 403: admin_policy_enforced` instead of letting you approve.
That's the one thing only you can test.

## 1. Create a Google Cloud project + enable the Gmail API

1. Go to https://console.cloud.google.com/projectcreate, create a new
   project (any name, e.g. "command-center").
2. With that project selected, go to
   https://console.cloud.google.com/apis/library/gmail.googleapis.com and
   click **Enable**.

## 2. Configure the OAuth consent screen

1. Go to https://console.cloud.google.com/apis/credentials/consent
2. User type: **External** (Princeton's Workspace isn't yours to configure
   as Internal).
3. Fill in the required fields (app name, your email) — doesn't need to be
   polished, this never goes through Google's review.
4. Add scope: `https://www.googleapis.com/auth/gmail.readonly`
5. Under **Test users**, add your Princeton email address. Apps in
   "Testing" publishing status work indefinitely for up to 100 named test
   users, with no review needed.

## 3. Create an OAuth Client ID

1. Go to https://console.cloud.google.com/apis/credentials
2. **Create Credentials → OAuth client ID**
3. Application type: **Desktop app**
4. Save the **Client ID** and **Client Secret** shown — these become
   `GMAIL_CLIENT_ID` and `GMAIL_CLIENT_SECRET`.

## 4. Get a refresh token (this is the Princeton consent step)

Easiest path is Google's OAuth Playground:

1. Go to https://developers.google.com/oauthplayground
2. Click the gear icon (top right) → check **"Use your own OAuth
   credentials"** → paste in your Client ID and Client Secret from step 3.
3. In the left panel, find and select the scope
   `https://www.googleapis.com/auth/gmail.readonly` (or paste it into the
   "Input your own scopes" box).
4. Click **Authorize APIs** — sign in with your **Princeton** account here.
   This is the step that will show `Error 403: admin_policy_enforced` if
   Princeton's admin blocks it.
5. If it succeeds, click **Exchange authorization code for tokens** — the
   **Refresh token** shown becomes `GMAIL_REFRESH_TOKEN`.

## 5. Set up a Gmail label for newsletters

The default search query is `newer_than:2d label:newsletters` — create a
label called **newsletters** in Gmail, then set up a filter (or manually
label emails) so your newsletter senders land under it. You can change the
query without touching code: it reads from `GMAIL_NEWSLETTER_QUERY` if set,
otherwise falls back to the default above.

## 6. Add the secrets

Add to your local `.env`:
```
GMAIL_CLIENT_ID=...
GMAIL_CLIENT_SECRET=...
GMAIL_REFRESH_TOKEN=...
```

And the same three to Vercel's Production environment variables
(`vercel env add GMAIL_CLIENT_ID production`, etc., or via the dashboard)
once you're ready to activate it in production.
