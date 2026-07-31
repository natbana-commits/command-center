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
