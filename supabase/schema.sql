-- Run this once in the Supabase SQL editor to set up news dedup.
create table if not exists seen_stories (
  url text primary key,
  seen_at timestamptz not null default now()
);

create index if not exists seen_stories_seen_at_idx on seen_stories (seen_at);

-- Holds the stories held back each morning until you reply asking for more.
create table if not exists pending_stories (
  id bigint generated always as identity primary key,
  urls jsonb not null,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

-- Full snapshot of a day's brief (all 8 stories, calendar) so the chat
-- webhook can answer questions hours later without re-running the
-- RSS/curation pipeline. Keyed by day so it naturally resets daily.
-- Reminders live in Google Tasks now (fetched live, not snapshotted here).
create table if not exists daily_context (
  day date primary key,
  timezone text not null,
  stories jsonb not null,
  calendar_events jsonb not null,
  created_at timestamptz not null default now()
);

-- Migration: drop the no-longer-used reminders column from an existing
-- table (safe no-op if you're running this fresh, or already dropped it).
alter table daily_context drop column if exists reminders;

-- Same-day conversational memory for the chat webhook. Scoped by day so
-- "today's history" is a simple equality filter.
create table if not exists chat_messages (
  id bigint generated always as identity primary key,
  day date not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_day_idx on chat_messages (day, created_at);

-- Newsletter emails pulled from Gmail (inactive until Google OAuth is set up
-- — see .env.example for the required GOOGLE_* secrets).
create table if not exists newsletters (
  id text primary key,
  day date not null,
  subject text not null,
  sender text not null,
  received_at timestamptz not null,
  html text not null,
  created_at timestamptz not null default now()
);

create index if not exists newsletters_day_idx on newsletters (day);

-- Single-row settings, replacing the old config/settings.json — editable
-- from the Donna settings page since a deployed function can't durably
-- write to a file in its own bundle. Reminders live in Google Tasks now,
-- not here.
create table if not exists app_settings (
  id int primary key,
  timezone text not null default 'America/New_York',
  newsletter_query text not null default 'newer_than:2d label:newsletters',
  updated_at timestamptz not null default now(),
  constraint app_settings_singleton check (id = 1)
);

insert into app_settings (id, timezone, newsletter_query)
values (1, 'America/New_York', 'newer_than:2d label:newsletters')
on conflict (id) do nothing;

-- Migration: drop the no-longer-used reminders column from an existing
-- table (safe no-op if you're running this fresh, or already dropped it).
alter table app_settings drop column if exists reminders;

-- Migration: customizable Home widget layout/nav visibility, and which
-- sections of the morning brief actually get texted. Defaults reproduce
-- today's behavior exactly (everything visible/on, in the existing order,
-- 4 headlines) so existing rows need no manual backfill.
alter table app_settings add column if not exists dashboard_config jsonb not null default '{
  "homeWidgets": [
    { "id": "recent-activity", "visible": true },
    { "id": "upcoming", "visible": true },
    { "id": "reminders", "visible": true }
  ],
  "defaultHomeTab": "news",
  "navVisibility": { "files": true, "calendar": true, "reminders": true }
}'::jsonb;

alter table app_settings add column if not exists brief_config jsonb not null default '{
  "news": true,
  "calendar": true,
  "reminders": true,
  "headlineCount": 4
}'::jsonb;

-- Maps a class name to a Google Drive folder, for the customizable file hub.
-- Populated from the Donna settings page whenever Nathan starts organizing
-- class files — empty until then.
create table if not exists class_folders (
  id bigint generated always as identity primary key,
  class_name text not null,
  drive_folder_id text not null,
  created_at timestamptz not null default now()
);

-- User-managed list of companies/tickers to watch for in the daily news
-- curation — a growing list of independent entries, same shape as
-- class_folders, not a config blob.
create table if not exists watchlist_entries (
  id bigint generated always as identity primary key,
  label text not null,
  created_at timestamptz not null default now()
);

-- Recruiting contacts (networking/coffee-chat tracker) — same shape as
-- class_folders/watchlist_entries.
create table if not exists contacts (
  id bigint generated always as identity primary key,
  name text not null,
  firm text,
  notes text,
  last_contacted_at date,
  bio text,
  relationship_tag text,
  created_at timestamptz not null default now()
);

-- Per-interaction log for a contact (call/email/coffee chat/etc, with its
-- own date and notes) — last_contacted_at on the parent row is bumped
-- forward (never back) whenever a newer interaction is logged, so "time
-- since contact" stays accurate without needing a join on every read.
create table if not exists contact_interactions (
  id bigint generated always as identity primary key,
  contact_id bigint not null references contacts(id) on delete cascade,
  interaction_type text not null,
  notes text,
  occurred_at date not null default current_date,
  created_at timestamptz not null default now()
);
create index if not exists contact_interactions_contact_id_idx on contact_interactions(contact_id);

-- Generic short-TTL cache for slow live external-API reads (Google
-- Calendar/Tasks/Drive) that would otherwise be re-fetched on every page
-- load. Not used for anything the app itself needs strong consistency on.
create table if not exists api_cache (
  cache_key text primary key,
  payload jsonb not null,
  expires_at timestamptz not null
);

-- Private bucket for lecture recordings and scanned photos/documents.
-- Uploads go directly from the browser to Storage via a service-role-minted
-- signed URL (bypasses Vercel's request body size limits), so no public
-- bucket policy or RLS is needed — the signed URL itself is the permission.
insert into storage.buckets (id, name, public)
values ('donna-uploads', 'donna-uploads', false)
on conflict (id) do nothing;

-- Tracks uploaded lecture recordings/photos and their processed results
-- (transcript + Claude-generated notes for audio, extracted text for
-- photos). Optionally tied to a class.
create table if not exists uploads (
  id bigint generated always as identity primary key,
  storage_path text not null,
  kind text not null check (kind in ('lecture', 'photo')),
  class_id bigint references class_folders (id) on delete set null,
  original_filename text not null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'done', 'failed')),
  transcript text,
  notes text,
  error text,
  created_at timestamptz not null default now()
);

create index if not exists uploads_class_id_idx on uploads (class_id);

-- Timed reminder nudges: a Google Task carries the reminder itself (so it
-- shows in Nathan's actual Tasks app), and this table tracks exactly when
-- to actually text him about it and whether that's already happened — the
-- Tasks API's own due field is date-only in every Google client, so this
-- is the only place the precise time lives. Checked every few minutes by
-- api/reminder-check.ts via a GitHub Actions poller (see docs/google-setup.md).
create table if not exists reminder_notifications (
  id bigint generated always as identity primary key,
  google_task_id text not null,
  notify_at timestamptz not null,
  message text not null,
  sent boolean not null default false,
  -- 'main' fires at the reminder's actual due time; 'early' is an
  -- optional second heads-up some number of minutes/hours/days before
  -- it. A task can have at most one pending row of each kind.
  kind text not null default 'main',
  created_at timestamptz not null default now()
);

create index if not exists reminder_notifications_pending_idx on reminder_notifications (sent, notify_at);

-- Links a Google Task (a reminder) to a class, for the coursework-
-- deadlines feature — Google Tasks has no custom-field support, so this
-- side table is the only place that association can live, same reasoning
-- as reminder_notifications above.
create table if not exists reminder_class_links (
  id bigint generated always as identity primary key,
  google_task_id text not null,
  class_id bigint not null references class_folders (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists reminder_class_links_class_id_idx on reminder_class_links (class_id);
create unique index if not exists reminder_class_links_task_id_idx on reminder_class_links (google_task_id);

-- One row per initial S-1 IPO registration Donna has fetched and
-- summarized (via the daily EDGAR poll or an on-demand chat lookup).
-- accession_no's uniqueness is the only dedup mechanism needed — the
-- EDGAR feed always returns the latest filings sorted newest-first, so
-- there's no separate "last checked" cursor to maintain.
create table if not exists ipo_filings (
  id bigint generated always as identity primary key,
  accession_no text not null unique,
  cik text not null,
  company_name text not null,
  ticker text,
  exchange text,
  filed_date date not null,
  source_url text not null,
  business_summary text,
  financials_summary text,
  deal_terms_summary text,
  risk_highlights text,
  created_at timestamptz not null default now()
);

create index if not exists ipo_filings_filed_date_idx on ipo_filings (filed_date desc);

-- Companies Nathan has asked to keep tracking beyond their initial S-1 —
-- checked daily for any new filing (amendments, the eventual 424B4
-- pricing prospectus) via EDGAR's per-company submissions feed.
create table if not exists followed_companies (
  id bigint generated always as identity primary key,
  cik text not null unique,
  company_name text not null,
  ticker text,
  last_seen_accession text,
  created_at timestamptz not null default now()
);

-- One row per linked Plaid Item (one bank login, which can hold several
-- accounts — e.g. checking + savings under one PNC login). access_token
-- is encrypted at the application layer (src/finance/crypto.ts, AES-256-
-- GCM) before it ever reaches this table — it's a meaningfully higher-
-- value secret than anything else this app stores. cursor is
-- transactions/sync's pagination cursor, null until the first sync.
create table if not exists plaid_items (
  id bigint generated always as identity primary key,
  item_id text not null unique,
  institution_name text not null,
  access_token_encrypted text not null,
  access_token_iv text not null,
  cursor text,
  needs_reauth boolean not null default false,
  created_at timestamptz not null default now()
);

-- Balances as of the last sync — cascades on the parent Item's removal
-- (unlinking a bank drops its accounts and transactions with it).
create table if not exists plaid_accounts (
  id bigint generated always as identity primary key,
  item_id text not null references plaid_items (item_id) on delete cascade,
  account_id text not null unique,
  name text not null,
  official_name text,
  type text not null,
  subtype text,
  mask text,
  current_balance numeric,
  available_balance numeric,
  iso_currency_code text,
  updated_at timestamptz not null default now()
);

-- Populated via Plaid's cursor-based /transactions/sync (not a full
-- re-fetch each time) — see src/finance/sync.ts.
create table if not exists plaid_transactions (
  id bigint generated always as identity primary key,
  transaction_id text not null unique,
  account_id text not null references plaid_accounts (account_id) on delete cascade,
  amount numeric not null,
  iso_currency_code text,
  name text not null,
  merchant_name text,
  category text,
  pending boolean not null default false,
  transaction_date date not null,
  created_at timestamptz not null default now()
);

create index if not exists plaid_transactions_account_date_idx on plaid_transactions (account_id, transaction_date desc);

-- Per-class persistent chat thread for the School page — isolated from
-- general Donna chat (chat_messages, scoped by day) and from other
-- classes, so studying for ECO 301 doesn't mix into ECO 302's thread or
-- reset overnight the way the general daily chat does.
create table if not exists school_chat_messages (
  id bigint generated always as identity primary key,
  class_id bigint not null references class_folders (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists school_chat_messages_class_id_idx on school_chat_messages (class_id, created_at);

-- Flashcard bank generated from a class's uploaded lecture transcripts
-- (src/school/generateFlashcards.ts). review_count/next_review_at drive a
-- lightweight spaced-repetition schedule (src/school/flashcards.ts) —
-- proportionate to a single-user study tool, not a full SM-2 algorithm.
create table if not exists flashcards (
  id bigint generated always as identity primary key,
  class_id bigint not null references class_folders (id) on delete cascade,
  question text not null,
  answer text not null,
  source_upload_id bigint references uploads (id) on delete set null,
  last_reviewed_at timestamptz,
  next_review_at timestamptz,
  review_count int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists flashcards_class_id_idx on flashcards (class_id);

-- User-defined reminder categories (School/Life/Personal/etc), each with a
-- color for visual grouping on the Reminders page. Independent of
-- class_folders/reminder_class_links — a reminder can have both a class
-- link and a group at the same time, unrelated to each other.
create table if not exists reminder_groups (
  id bigint generated always as identity primary key,
  name text not null unique,
  color text not null,
  created_at timestamptz not null default now()
);

insert into reminder_groups (name, color)
values ('School', '#4a7a96'), ('Life', '#7a9d54'), ('Personal', '#b86b45')
on conflict (name) do nothing;

-- One group per reminder, same one-per-task shape as reminder_class_links
-- (unique index on google_task_id, not just an index).
create table if not exists reminder_group_links (
  id bigint generated always as identity primary key,
  google_task_id text not null,
  group_id bigint not null references reminder_groups (id) on delete cascade,
  created_at timestamptz not null default now()
);
create unique index if not exists reminder_group_links_task_id_idx on reminder_group_links (google_task_id);
create index if not exists reminder_group_links_group_id_idx on reminder_group_links (group_id);

-- Rate-limits /donna/login: a rolling window of recent failed attempts
-- per IP (src/auth/loginAttempts.ts). Old rows are pruned daily
-- alongside everything else in formatBrief.ts, so this never grows
-- unbounded even under a sustained attack.
create table if not exists login_attempts (
  id bigint generated always as identity primary key,
  ip_address text not null,
  attempted_at timestamptz not null default now()
);
create index if not exists login_attempts_ip_idx on login_attempts (ip_address, attempted_at desc);

-- Habit tracker: a proactive daily Telegram nudge at notify_time (local
-- time-of-day, stored as plain "HH:MM" text rather than a `time` column so
-- src/habits/store.ts can compare it against a locally-formatted string
-- without a timezone-aware SQL comparison). last_notified_date guards
-- against re-sending the same day's nudge on every reminder-check poll.
create table if not exists habits (
  id bigint generated always as identity primary key,
  title text not null,
  notify_time text not null,
  active boolean not null default true,
  last_notified_date date,
  created_at timestamptz not null default now()
);

-- One row per day a habit was checked off; the unique constraint is what
-- makes toggling idempotent (re-checking the same day is a delete, not a
-- second insert) and is what streak calculation counts consecutive days
-- over.
create table if not exists habit_completions (
  id bigint generated always as identity primary key,
  habit_id bigint not null references habits (id) on delete cascade,
  completed_date date not null,
  created_at timestamptz not null default now()
);
create unique index if not exists habit_completions_habit_date_idx on habit_completions (habit_id, completed_date);

-- One row per linked account per day, taken by the daily morning-brief cron
-- (src/finance/balanceHistory.ts) — the only place account balance history
-- accumulates, since plaid_accounts itself is overwritten in place on every
-- sync. is_liability is snapshotted alongside the balance (rather than
-- joined against plaid_accounts.type at query time) so net-worth history
-- stays correct even if an account is later unlinked.
create table if not exists account_balance_history (
  id bigint generated always as identity primary key,
  account_id text not null,
  balance numeric not null,
  is_liability boolean not null default false,
  snapshot_date date not null,
  created_at timestamptz not null default now()
);
create unique index if not exists account_balance_history_account_date_idx on account_balance_history (account_id, snapshot_date);

-- Manually-seeded economic calendar (src/markets/economicEvents.ts) —
-- deliberately NOT backed by a live API: FOMC/CPI/NFP/GDP dates are
-- published by the Fed/BLS/BEA many months in advance, so a scraper or
-- paid data feed would be solving a problem that doesn't exist. Seeded
-- once below from the real, current official calendars (federalreserve.gov,
-- bls.gov, bea.gov) as of 2026-08-01 — refresh annually from those same
-- sources (flagged on the Info page as a yearly maintenance step).
create table if not exists economic_events (
  id bigint generated always as identity primary key,
  event_name text not null,
  event_date date not null,
  category text not null,
  source_note text,
  created_at timestamptz not null default now()
);
create unique index if not exists economic_events_name_date_idx on economic_events (event_name, event_date);
create index if not exists economic_events_date_idx on economic_events (event_date);

insert into economic_events (event_name, event_date, category, source_note) values
  ('FOMC Meeting', '2026-09-16', 'FOMC', 'federalreserve.gov'),
  ('FOMC Meeting', '2026-10-28', 'FOMC', 'federalreserve.gov'),
  ('FOMC Meeting', '2026-12-09', 'FOMC', 'federalreserve.gov'),
  ('FOMC Meeting', '2027-01-27', 'FOMC', 'federalreserve.gov'),
  ('FOMC Meeting', '2027-03-17', 'FOMC', 'federalreserve.gov'),
  ('FOMC Meeting', '2027-04-28', 'FOMC', 'federalreserve.gov'),
  ('FOMC Meeting', '2027-06-09', 'FOMC', 'federalreserve.gov'),
  ('FOMC Meeting', '2027-07-28', 'FOMC', 'federalreserve.gov'),
  ('FOMC Meeting', '2027-09-15', 'FOMC', 'federalreserve.gov'),
  ('FOMC Meeting', '2027-10-27', 'FOMC', 'federalreserve.gov'),
  ('FOMC Meeting', '2027-12-08', 'FOMC', 'federalreserve.gov'),
  ('CPI Release', '2026-08-12', 'CPI', 'bls.gov'),
  ('CPI Release', '2026-09-11', 'CPI', 'bls.gov'),
  ('CPI Release', '2026-10-14', 'CPI', 'bls.gov'),
  ('CPI Release', '2026-11-10', 'CPI', 'bls.gov'),
  ('CPI Release', '2026-12-10', 'CPI', 'bls.gov'),
  ('Jobs Report (NFP)', '2026-08-07', 'NFP', 'bls.gov'),
  ('Jobs Report (NFP)', '2026-09-04', 'NFP', 'bls.gov'),
  ('Jobs Report (NFP)', '2026-10-02', 'NFP', 'bls.gov'),
  ('Jobs Report (NFP)', '2026-11-06', 'NFP', 'bls.gov'),
  ('Jobs Report (NFP)', '2026-12-04', 'NFP', 'bls.gov'),
  ('GDP (Advance Estimate), Q3 2026', '2026-10-29', 'GDP', 'bea.gov'),
  ('GDP (Second Estimate), Q3 2026', '2026-11-25', 'GDP', 'bea.gov'),
  ('GDP (Third Estimate), Q3 2026', '2026-12-23', 'GDP', 'bea.gov')
on conflict (event_name, event_date) do nothing;

-- Client-side study timer (src/school/studySessions.ts) — only a
-- COMPLETED session (5+ minutes, per the client script) ever reaches this
-- table; an in-progress or abandoned timer is never persisted, since the
-- timer itself is deliberately client-side-only state.
create table if not exists study_sessions (
  id bigint generated always as identity primary key,
  class_id bigint not null references class_folders (id) on delete cascade,
  duration_minutes integer not null,
  completed_at timestamptz not null default now()
);
create index if not exists study_sessions_class_idx on study_sessions (class_id, completed_at desc);

-- Community feed widget sources (src/news/communityFeeds.ts) — plain RSS,
-- no Claude summarization (keeps this at ~zero marginal API cost), managed
-- from Settings with the same list+add-form pattern as Watchlist/Classes.
-- Seeded with 3 reasonable finance-recruiting-adjacent defaults; edit or
-- replace them any time.
create table if not exists community_feed_sources (
  id bigint generated always as identity primary key,
  url text not null,
  label text not null,
  created_at timestamptz not null default now()
);
create unique index if not exists community_feed_sources_url_idx on community_feed_sources (url);

insert into community_feed_sources (url, label) values
  ('https://www.reddit.com/r/FinancialCareers/.rss', 'r/FinancialCareers'),
  ('https://www.reddit.com/r/investing/.rss', 'r/investing'),
  ('https://www.reddit.com/r/SecurityAnalysis/.rss', 'r/SecurityAnalysis')
on conflict (url) do nothing;

-- Server-side session store (src/auth/session.ts) — replaces the earlier
-- purely stateless HMAC-signed cookie, which had no way to revoke a
-- single session (only rotating SESSION_SECRET, which logs out every
-- device at once). The cookie now holds a signed reference to a row
-- here, so a specific device's session (e.g. a lost phone) can be killed
-- from Settings on any other device without affecting the rest.
create table if not exists sessions (
  id text primary key,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_seen_at timestamptz not null default now(),
  user_agent text,
  revoked boolean not null default false
);
create index if not exists sessions_expires_idx on sessions (expires_at);

-- Dynamic brief scheduling state (src/chat/dailyContext.ts) — replaces a
-- fixed vercel.json cron time (which can't read from Settings and drifts
-- an hour twice a year across DST) with a check on every existing 5-
-- minute GitHub Actions poll: "has today's configured send time passed,
-- and have I not sent yet?" These two timestamps are that state, one row
-- per day, doubling as the guard against sending either pass twice.
alter table daily_context add column if not exists brief_sent_at timestamptz;
alter table daily_context add column if not exists news_attempted_at timestamptz;
