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
