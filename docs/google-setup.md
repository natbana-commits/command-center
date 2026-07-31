# Google (Gmail + Drive + Tasks + Calendar) setup

Gmail (newsletters + general email search), the Drive file hub, Google
Tasks reminders, and calendar-write access (for Donna to actually book a
free slot she finds) are all fully coded but stay inactive (no-op silently)
until you complete this setup and add three secrets. Nothing here touches
the working parts of the brief — the code checks for these values and
skips those features if they're missing. One OAuth client covers all four
scopes, so you only do this once.

**Already done Gmail/Drive/Tasks setup and just adding calendar-write
access?** You only need to redo two things: add the calendar scope in
step 2's Data Access tab (it's the one new bullet there), enable the
Calendar API in step 1, then redo step 4's authorization with all four
scopes together to get a new `GOOGLE_REFRESH_TOKEN` — steps 1's other APIs
and step 3's OAuth client don't need to be recreated.

## Before you start: check the Princeton account restriction

Sign in to https://console.cloud.google.com with your **personal** Google
account (not Princeton) for the steps below — Princeton's account only needs
to be used at the very last step, to grant consent. If Princeton's Workspace
admin blocks third-party OAuth apps, you'll find out at that step: Google
will show `Error 403: admin_policy_enforced` instead of letting you approve.
That's the one thing only you can test.

## 1. Create a Google Cloud project + enable all four APIs

1. Go to https://console.cloud.google.com/projectcreate, create a new
   project (any name, e.g. "command-center").
2. With that project selected, enable all four:
   - https://console.cloud.google.com/apis/library/gmail.googleapis.com → **Enable**
   - https://console.cloud.google.com/apis/library/drive.googleapis.com → **Enable**
   - https://console.cloud.google.com/apis/library/tasks.googleapis.com → **Enable**
   - https://console.cloud.google.com/apis/library/calendar-json.googleapis.com → **Enable**

## 2. Configure the OAuth consent screen

1. Go to https://console.cloud.google.com/apis/credentials/consent
2. User type: **External** (Princeton's Workspace isn't yours to configure
   as Internal).
3. Fill in the required fields (app name, your email) — doesn't need to be
   polished, this never goes through Google's review.
4. Add all four scopes:
   - `https://www.googleapis.com/auth/gmail.readonly`
   - `https://www.googleapis.com/auth/drive.readonly`
   - `https://www.googleapis.com/auth/tasks` (read/write — needed so Donna
     can create and complete reminders, not just read them)
   - `https://www.googleapis.com/auth/calendar.events` (read/write on
     events only, not the whole calendar — needed so Donna can actually
     book a free slot she finds, not just read what's already there)
5. Under **Test users**, add your Princeton email address. Apps in
   "Testing" publishing status work indefinitely for up to 100 named test
   users, with no review needed.

## 3. Create an OAuth Client ID

1. Go to https://console.cloud.google.com/apis/credentials
2. **Create Credentials → OAuth client ID**
3. Application type: **Web application** — not Desktop app. Desktop-app
   clients can't have a custom redirect URI, which the OAuth Playground
   step below needs; using one produces `Error 400: redirect_uri_mismatch`.
   A Web application client works fine for the refresh-token grant this
   project actually uses at runtime, so there's no downside to using it
   permanently (not just for this one-time step).
4. Under **Authorized redirect URIs**, add exactly:
   `https://developers.google.com/oauthplayground`
5. Save the **Client ID** and **Client Secret** shown — these become
   `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

## 4. Get a refresh token (this is the Princeton consent step)

Easiest path is Google's OAuth Playground:

1. Go to https://developers.google.com/oauthplayground
2. Click the gear icon (top right) → check **"Use your own OAuth
   credentials"** → paste in your Client ID and Client Secret from step 3.
3. In the left panel, select all **four** scopes in one pass before
   authorizing — doing them one at a time produces separate authorizations
   instead of one refresh token covering all four:
   `https://www.googleapis.com/auth/gmail.readonly`,
   `https://www.googleapis.com/auth/drive.readonly`,
   `https://www.googleapis.com/auth/tasks`, and
   `https://www.googleapis.com/auth/calendar.events` (or paste them into
   the "Input your own scopes" box, space-separated).
4. Click **Authorize APIs** — sign in with your **Princeton** account here
   (use "Use another account" if your personal account is already signed
   in — authorizing with the wrong account produces `Error 403:
   access_denied` since only Princeton's address is a test user). This is
   also the step that will show `Error 403: admin_policy_enforced` if
   Princeton's admin blocks third-party OAuth apps outright.
5. If it succeeds, click **Exchange authorization code for tokens** — the
   **Refresh token** shown becomes `GOOGLE_REFRESH_TOKEN`, replacing
   whatever value is there today. One token grants all four scopes since
   you requested them together — this one new token is a full replacement,
   not an addition, so update it everywhere the old one was set (local
   `.env`, Vercel Production, and any preview branch it was scoped to).

## 5. Set up a Gmail label for newsletters

Manage the search query from the Donna settings page (`/donna/settings`)
once it's built — default is `newer_than:2d label:newsletters`. Create a
label called **newsletters** in Gmail, then set up a filter (or manually
label emails) so your newsletter senders land under it. General email
search (asking Donna about any email, not just newsletters) needs no setup
— it's just a broader use of the same read access.

## 6. Reminders via Google Tasks

Nothing to set up here — Donna creates and uses a dedicated task list
(named "Donna Reminders") automatically the first time she needs one. The
old custom reminders field is gone; ask Donna (Telegram or the web Chat
tab) to add/complete reminders and they'll show up in your actual Google
Tasks app too.

## 7. Calendar scheduling ("watch a film for 20 minutes in the next two days")

Nothing extra to set up once the calendar scope above is authorized — ask
Donna (Telegram or the web Chat tab) for something like this and she'll
check your calendar for a free slot (8am–10pm) in the window you gave her
and book it directly, no separate confirmation step (same as how she adds
reminders immediately rather than just talking about it). If nothing fits,
she'll say so instead of guessing.

## 8. Timed reminder nudges ("remind me in 30 minutes" / "homework due Wednesday")

Reminders with an actual delivery time (not just a checklist item) need one
more piece: a scheduled job that checks every few minutes for anything due
and texts you. Vercel's own free-tier cron only runs once a day, so this
uses a GitHub Actions workflow in this repo instead (free, no new account).

You need to add one secret to GitHub for this to work:
1. Go to this repo's **Settings → Secrets and variables → Actions → New
   repository secret**.
2. Name it `REMINDER_CHECK_SECRET`, value: whatever's in your `.env` for
   that same key (I'll generate and set the Vercel side of this for you —
   this GitHub half is the one step I can't do myself).

## 9. Organize class files in Drive (whenever you start)

No specific folder structure is required ahead of time — once you have
class files, create a folder per class and add the mapping from the Donna
settings page (paste the folder's share link, Donna extracts the folder ID).

## 10. Add the secrets

Add to your local `.env`:
```
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REFRESH_TOKEN=...
REMINDER_CHECK_SECRET=...
```

And the same to Vercel's Production environment variables
(`vercel env add GOOGLE_CLIENT_ID production`, etc., or via the dashboard)
once you're ready to activate it in production. `REMINDER_CHECK_SECRET`
also needs to go into GitHub as a repository secret — see step 8 above.
