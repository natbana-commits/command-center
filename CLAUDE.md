# Personal Command Center

## What this is
A personal productivity hub for Nathan, a Princeton econ student. One place
that surfaces today's relevant news, holds class files and workflow, connects
to Google Calendar, lets me edit what gets pushed to my phone over Telegram,
fires reminders as texts, and lays it all out on a customizable dashboard.

## Architecture (two layers, keep them separate)
1. Dashboard app. A React web app hosted on Vercel that I open in a browser.
   Shows a news feed, a calendar view, a reminders list, a file hub, and a
   settings screen where I edit what gets texted and which widgets show.
2. Automation layer. An always-on cloud job that does the scheduled work
   whether the dashboard is open or not. It compiles the morning brief from
   news, calendar, and reminders, then sends it to me over Telegram. Runs
   server-side so my laptop can stay closed.

## Delivery
Push goes to me through a Telegram bot. The bot token and my chat id live as
environment secrets and are never hardcoded or committed. Sending is a POST to
the Telegram sendMessage API.

## Design constraints
- Cloud-hosted throughout, so nothing depends on my Mac being awake.
- Class files live in Google Drive, organized by course. A cloud app cannot see
  my local disk, so the file hub reads from Drive.
- Calendar comes from Google Calendar, read-only to start.
- My config and reminders persist in a small database (Supabase Postgres or
  similar) so the scheduled job can read my settings and fire reminders on time.

## News focus
The feed filters for markets, equity capital markets, and finance-recruiting
relevance. I already built a React app called The Briefing with curation logic
worth reusing or porting here.

## Classes
Coursework includes ECO 301 and ECO 302. The file hub should let me pull the
relevant files for a given class on demand.

## Build order (do NOT build everything at once)
Ship in stages, always leaving something working.
- v1. Automation layer only. A scheduled cloud job that texts me news plus
  today's calendar plus reminders every weekday morning over Telegram, driven
  by a simple editable config file. No dashboard yet.
- v2. React dashboard as a face on top. News panel, calendar view, reminders,
  settings screen.
- v3. Drive-connected file hub and a customizable widget layout.

## How I want you to work
- Explain the plan at a high level before any large change, and wait for my go
  ahead on architecture decisions.
- Match the code style my Briefing app already sets where it applies.
- Flag any step that needs a credential or account setup so I can do it myself.
- Keep all secrets in environment variables, never in committed code.

## Start here
Begin with v1. First propose the stack and the repo structure for the
automation layer, then stop and wait for my approval before writing code.
