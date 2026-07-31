# Google (Gmail + Drive) setup

Gmail newsletters and the Drive file hub are both fully coded but stay
inactive (no-op silently) until you complete this setup and add three
secrets. Nothing here touches the working parts of the brief — the code
checks for these values and skips both features if they're missing. One
OAuth client covers both, so you only do this once.

## Before you start: check the Princeton account restriction

Sign in to https://console.cloud.google.com with your **personal** Google
account (not Princeton) for the steps below — Princeton's account only needs
to be used at the very last step, to grant consent. If Princeton's Workspace
admin blocks third-party OAuth apps, you'll find out at that step: Google
will show `Error 403: admin_policy_enforced` instead of letting you approve.
That's the one thing only you can test.

## 1. Create a Google Cloud project + enable both APIs

1. Go to https://console.cloud.google.com/projectcreate, create a new
   project (any name, e.g. "command-center").
2. With that project selected, enable both:
   - https://console.cloud.google.com/apis/library/gmail.googleapis.com → **Enable**
   - https://console.cloud.google.com/apis/library/drive.googleapis.com → **Enable**

## 2. Configure the OAuth consent screen

1. Go to https://console.cloud.google.com/apis/credentials/consent
2. User type: **External** (Princeton's Workspace isn't yours to configure
   as Internal).
3. Fill in the required fields (app name, your email) — doesn't need to be
   polished, this never goes through Google's review.
4. Add both scopes:
   - `https://www.googleapis.com/auth/gmail.readonly`
   - `https://www.googleapis.com/auth/drive.readonly`
5. Under **Test users**, add your Princeton email address. Apps in
   "Testing" publishing status work indefinitely for up to 100 named test
   users, with no review needed.

## 3. Create an OAuth Client ID

1. Go to https://console.cloud.google.com/apis/credentials
2. **Create Credentials → OAuth client ID**
3. Application type: **Desktop app**
4. Save the **Client ID** and **Client Secret** shown — these become
   `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

## 4. Get a refresh token (this is the Princeton consent step)

Easiest path is Google's OAuth Playground:

1. Go to https://developers.google.com/oauthplayground
2. Click the gear icon (top right) → check **"Use your own OAuth
   credentials"** → paste in your Client ID and Client Secret from step 3.
3. In the left panel, find and select **both** scopes:
   `https://www.googleapis.com/auth/gmail.readonly` and
   `https://www.googleapis.com/auth/drive.readonly` (or paste them into the
   "Input your own scopes" box, space-separated).
4. Click **Authorize APIs** — sign in with your **Princeton** account here.
   This is the step that will show `Error 403: admin_policy_enforced` if
   Princeton's admin blocks it.
5. If it succeeds, click **Exchange authorization code for tokens** — the
   **Refresh token** shown becomes `GOOGLE_REFRESH_TOKEN`. One token grants
   both scopes since you requested both together.

## 5. Set up a Gmail label for newsletters

Manage the search query from the Donna settings page (`/donna/settings`)
once it's built — default is `newer_than:2d label:newsletters`. Create a
label called **newsletters** in Gmail, then set up a filter (or manually
label emails) so your newsletter senders land under it.

## 6. Organize class files in Drive (whenever you start)

No specific folder structure is required ahead of time — once you have
class files, create a folder per class and add the mapping from the Donna
settings page (paste the folder's share link, Donna extracts the folder ID).

## 7. Add the secrets

Add to your local `.env`:
```
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REFRESH_TOKEN=...
```

And the same three to Vercel's Production environment variables
(`vercel env add GOOGLE_CLIENT_ID production`, etc., or via the dashboard)
once you're ready to activate it in production.
