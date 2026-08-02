import { loadSettings } from "./config.js";
import { formatReminders } from "./reminders.js";
import { getTodaysEvents, formatEvents } from "./calendar.js";
import { fetchFeedItems } from "./news/feeds.js";
import { curateStories } from "./news/curate.js";
import { formatStoryMessages, formatMorePrompt } from "./news/format.js";
import { filterUnseen, markSeen, pruneOldSeen } from "./news/dedup.js";
import { storePendingStories } from "./news/pending.js";
import { getWatchlistEntries } from "./news/watchlist.js";
import {
  storeDailyContext,
  updateDailyContextStories,
  getTodaysBriefState,
  pruneOldDailyContext,
} from "./chat/dailyContext.js";
import { pruneOldChatMessages } from "./chat/history.js";
import { localDateKey, localWeekdayIndex, resolveTimezone, toLocalDateTimeParts } from "./util/time.js";
import { buildWeeklyDigestMessages } from "./weeklyDigest.js";
import { fetchAndStoreNewsletters, pruneOldNewsletters } from "./gmail/index.js";
import { listRemindersSafe } from "./google/tasks.js";
import { isGoogleConfigured } from "./google/auth.js";
import { pruneOldReminderNotifications } from "./reminders/notifications.js";
import { pruneOldLoginAttempts } from "./auth/loginAttempts.js";
import { pruneOldSessions } from "./auth/session.js";
import { checkAndSummarizeNewIpos } from "./ipos/checkNewIpos.js";
import { checkFollowedCompanyUpdates } from "./ipos/followedCompanies.js";
import { isPlaidConfigured } from "./finance/plaidClient.js";
import { snapshotAccountBalances } from "./finance/balanceHistory.js";
import { getEconomicEventsInWindow } from "./markets/economicEvents.js";
import { withTimeout } from "./util/timeout.js";

// A busy filing day can mean several large SEC documents each going
// through a full Claude summarization pass — even running concurrently
// (see checkNewIpos.ts), that's slow enough to have actually blown past
// Vercel's function time limit and killed the *entire* brief (not just
// the IPO section) on 2026-08-01 and 2026-08-02. IPO filings are already
// designed to tolerate being "delayed, not lost" (checkNewIpos.ts's own
// MAX_PER_RUN comment: unprocessed ones just get picked up next run via
// accession-number dedup) — this just adds an actual wall-clock cap to
// back that up, since concurrency alone only bounded count, not time.
const IPO_CHECK_TIMEOUT_MS = 20_000;

// News curation now runs as its own separately-scheduled pass (see
// buildNewsFollowupMessages/checkAndSendScheduledBrief below) with
// nothing else competing for its time budget, so this can afford to be
// generous — the original single-invocation design measured curation
// alone at ~59s (two-paragraph summaries) / ~47s (shortened, see
// curate.ts), which is what silently killed the entire brief on
// 2026-08-01/02. A slow/failed curation still means "no curated news
// today," not "no brief at all": unseen feed items are simply left
// unmarked-seen on a timeout/failure, so they're picked back up whole on
// the next run, same "delayed, not lost" tolerance as the IPO check.
const CURATION_TIMEOUT_MS = 55_000;

// How long after the fast pass sends before the scheduler attempts the
// news follow-up — long enough to read as a distinct "here's your news"
// message rather than a stray duplicate, short enough that it still
// feels like the same morning brief.
const NEWS_FOLLOWUP_DELAY_MS = 4 * 60 * 1000;

export interface BriefMessage {
  text: string;
  parseMode?: "HTML";
}

// Everything except curated news headlines — calendar, reminders, IPO
// filings/updates, econ events, the weekly digest, and all the
// background bookkeeping (newsletters, Plaid sync, prunes). None of this
// depends on the slow, LLM-heavy news-curation call, so it's effectively
// guaranteed to finish and send well within budget every day. Also seeds
// today's daily_context row (stories: [] for now, filled in later by
// buildNewsFollowupMessages without disturbing what's written here).
export async function buildFastBriefMessages(): Promise<BriefMessage[]> {
  const settings = await loadSettings();
  const [calendarResult, ipoFilings, followedUpdates] = await Promise.all([
    getTodaysEvents(settings.timezone),
    settings.briefConfig.ipos
      ? withTimeout(checkAndSummarizeNewIpos().catch(() => []), IPO_CHECK_TIMEOUT_MS, [])
      : Promise.resolve([]),
    settings.briefConfig.ipos
      ? withTimeout(checkFollowedCompanyUpdates().catch(() => []), IPO_CHECK_TIMEOUT_MS, [])
      : Promise.resolve([]),
  ]);
  const day = localDateKey(new Date(), calendarResult.timezone);

  const remindersPromise = listRemindersSafe();
  const backgroundWorkPromise = Promise.all([
    // No-ops until GOOGLE_* secrets are configured — safe to call unconditionally.
    fetchAndStoreNewsletters(day, settings.newsletterQuery),
    isPlaidConfigured()
      ? snapshotAccountBalances().catch((err) => console.error("Balance snapshot failed:", err))
      : Promise.resolve(),
    pruneOldSeen(),
    pruneOldChatMessages(),
    pruneOldDailyContext(),
    pruneOldNewsletters(),
    pruneOldReminderNotifications(),
    pruneOldLoginAttempts(),
    pruneOldSessions(),
  ]);

  // Seeds the row brief_sent_at-stamped, which is also what tells the
  // scheduler this pass has run for today.
  await storeDailyContext({ day, timezone: calendarResult.timezone, stories: [], events: calendarResult.events });

  const reminders = await remindersPromise;
  await backgroundWorkPromise;

  const { calendar, reminders: remindersEnabled } = settings.briefConfig;
  const messages: BriefMessage[] = [];

  messages.push({
    text: "Morning — brief's ready. Full summaries, images, and newsletters: https://command-center-navy-pi.vercel.app/donna",
  });

  if (calendar || remindersEnabled) {
    const blocks: string[] = [];
    if (calendar) blocks.push(`<b>Today's Calendar</b>\n${formatEvents(calendarResult)}`);
    if (remindersEnabled) blocks.push(`<b>Reminders</b>\n${formatReminders(reminders, isGoogleConfigured())}`);
    messages.push({ text: blocks.join("\n\n"), parseMode: "HTML" });
  }

  if (ipoFilings.length > 0) {
    const names = ipoFilings.map((f) => f.companyName).join(", ");
    messages.push({
      text: `🆕 New IPO filing(s): ${names} — see the full digest: https://command-center-navy-pi.vercel.app/donna/ipos`,
    });
  }

  if (followedUpdates.length > 0) {
    const lines = followedUpdates
      .map(({ company, filing }) => `📄 Update on ${company.companyName}: new filing (${filing.filedDate})`)
      .join("\n");
    messages.push({ text: `${lines}\nSee the IPOs page: https://command-center-navy-pi.vercel.app/donna/ipos` });
  }

  const tomorrowKey = localDateKey(new Date(Date.now() + 24 * 60 * 60 * 1000), calendarResult.timezone);
  const todayEconEvents = await getEconomicEventsInWindow(day, tomorrowKey).catch(() => []);
  if (todayEconEvents.length > 0) {
    const lines = todayEconEvents.map((e) => `📊 ${e.eventName} — ${e.eventDate === day ? "today" : "tomorrow"}`);
    messages.push({ text: lines.join("\n") });
  }

  if (
    settings.briefConfig.weeklyDigestEnabled &&
    localWeekdayIndex(new Date(), calendarResult.timezone) === settings.briefConfig.weeklyDigestDay
  ) {
    messages.push(...(await buildWeeklyDigestMessages(calendarResult.timezone)));
  }

  return messages;
}

// News curation, run as its own separately-scheduled pass a few minutes
// after buildFastBriefMessages — nothing else competes for its time
// budget here, so CURATION_TIMEOUT_MS can afford to be generous. Returns
// [] (sends nothing further) if news is disabled, there's nothing new
// today, or curation still fails/times out even with this dedicated
// budget — unseen feed items are simply left unmarked-seen in that last
// case, so they're picked back up whole on a later run rather than lost.
export async function buildNewsFollowupMessages(): Promise<BriefMessage[]> {
  const settings = await loadSettings();
  if (!settings.briefConfig.news) return [];

  const timezone = resolveTimezone(settings.timezone);
  const day = localDateKey(new Date(), timezone);
  const [feedItems, watchlistEntries] = await Promise.all([fetchFeedItems(), getWatchlistEntries()]);

  const unseenItems = await filterUnseen(feedItems);
  const curated = await withTimeout(
    curateStories(unseenItems, watchlistEntries.map((e) => e.label)).catch((err) => {
      console.error("News curation failed:", err);
      return [];
    }),
    CURATION_TIMEOUT_MS,
    []
  );
  if (curated.length === 0) {
    // Still mark the day as "attempted" so the scheduler doesn't retry
    // every 5 minutes for the rest of the day — a quiet news day and a
    // failed/timed-out curation are both handled the same way here.
    await updateDailyContextStories(day, []).catch((err) => console.error("Failed to record news attempt:", err));
    return [];
  }

  // Attach the image and original publish date from the feed item rather
  // than trusting the model to pass them through unchanged.
  const imageByUrl = new Map(unseenItems.map((item) => [item.link, item.imageUrl]));
  const publishedAtByUrl = new Map(unseenItems.map((item) => [item.link, item.publishedAt.toISOString()]));
  const stories = curated.map((story) => ({
    ...story,
    imageUrl: imageByUrl.get(story.url),
    publishedAt: publishedAtByUrl.get(story.url),
  }));

  const headlineCount = settings.briefConfig.headlineCount;
  // Watchlist matches sort first regardless of relevance, so they land in
  // the texted subset (not just the full stored set) even when
  // headlineCount is small — "bump it in the daily 8" needs to mean the
  // headlines that actually get sent, not just what's stored for the
  // dashboard.
  const sorted = [...stories].sort((a, b) => {
    const watchlistDiff = Number(b.watchlistMatch ?? false) - Number(a.watchlistMatch ?? false);
    return watchlistDiff !== 0 ? watchlistDiff : b.relevance - a.relevance;
  });
  const shown = sorted.slice(0, headlineCount);
  const held = sorted.slice(headlineCount);

  const updatedExistingRow = await updateDailyContextStories(day, stories);
  await Promise.all([
    markSeen(stories.map((s) => s.url)),
    storePendingStories(held),
    // The fast pass normally seeds today's row first — if it somehow
    // hasn't (e.g. manual/out-of-order testing), fall back to a full
    // write so the news isn't silently dropped.
    updatedExistingRow ? Promise.resolve() : storeDailyContext({ day, timezone, stories, events: [] }),
  ]);

  const messages: BriefMessage[] = [];
  messages.push(...formatStoryMessages(shown));
  messages.push(formatMorePrompt(held));
  return messages;
}

// Checked on every 5-minute reminder-check poll (see api/morning-brief.ts)
// — replaces a fixed vercel.json cron time with one driven by
// settings.briefConfig.sendTime, so changing it in Settings takes effect
// on the very next poll with no redeploy, and comparisons happen in the
// configured timezone's own wall-clock time rather than a static UTC
// cron string that would otherwise drift an hour across DST twice a year.
export async function checkAndSendScheduledBrief(
  sendMessage: (text: string, parseMode?: "HTML") => Promise<void>
): Promise<void> {
  const settings = await loadSettings();
  const timezone = resolveTimezone(settings.timezone);
  const day = localDateKey(new Date(), timezone);
  const state = await getTodaysBriefState(day);
  const nowLocal = toLocalDateTimeParts(new Date().toISOString(), timezone).time;

  if (!state?.briefSentAt) {
    if (nowLocal >= settings.briefConfig.sendTime) {
      const messages = await buildFastBriefMessages();
      for (const message of messages) {
        await sendMessage(message.text, message.parseMode);
      }
    }
    return;
  }

  if (!state.newsAttemptedAt) {
    const sentAt = new Date(state.briefSentAt).getTime();
    if (Date.now() - sentAt >= NEWS_FOLLOWUP_DELAY_MS) {
      const messages = await buildNewsFollowupMessages();
      for (const message of messages) {
        await sendMessage(message.text, message.parseMode);
      }
    }
  }
}

// Manual/CLI convenience (npm run send-test) — runs both passes back to
// back rather than waiting on the scheduler, for a one-off local test of
// the full pipeline.
export async function buildBriefMessages(): Promise<BriefMessage[]> {
  const fast = await buildFastBriefMessages();
  const news = await buildNewsFollowupMessages();
  return [...fast, ...news];
}
