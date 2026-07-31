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

-- Full snapshot of a day's brief (all 8 stories, calendar, reminders) so the
-- chat webhook can answer questions hours later without re-running the
-- RSS/curation pipeline. Keyed by day so it naturally resets daily.
create table if not exists daily_context (
  day date primary key,
  timezone text not null,
  stories jsonb not null,
  calendar_events jsonb not null,
  reminders jsonb not null,
  created_at timestamptz not null default now()
);

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
-- write to a file in its own bundle.
create table if not exists app_settings (
  id int primary key,
  timezone text not null default 'America/New_York',
  reminders jsonb not null default '[]'::jsonb,
  newsletter_query text not null default 'newer_than:2d label:newsletters',
  updated_at timestamptz not null default now(),
  constraint app_settings_singleton check (id = 1)
);

insert into app_settings (id, timezone, reminders, newsletter_query)
values (1, 'America/New_York', '[]'::jsonb, 'newer_than:2d label:newsletters')
on conflict (id) do nothing;

-- Maps a class name to a Google Drive folder, for the customizable file hub.
-- Populated from the Donna settings page whenever Nathan starts organizing
-- class files — empty until then.
create table if not exists class_folders (
  id bigint generated always as identity primary key,
  class_name text not null,
  drive_folder_id text not null,
  created_at timestamptz not null default now()
);
