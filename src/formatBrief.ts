import { loadSettings } from "./config.js";
import { formatReminders } from "./reminders.js";
import { getTodaysEvents, formatEvents } from "./calendar.js";
import { fetchFeedItems } from "./news/feeds.js";
import { curateStories } from "./news/curate.js";
import { formatStoryMessages, formatMorePrompt } from "./news/format.js";
import { filterUnseen, markSeen, pruneOldSeen } from "./news/dedup.js";
import { storePendingStories } from "./news/pending.js";
import { getWatchlistEntries } from "./news/watchlist.js";
import { storeDailyContext, pruneOldDailyContext } from "./chat/dailyContext.js";
import { pruneOldChatMessages } from "./chat/history.js";
import { localDateKey } from "./util/time.js";
import { fetchAndStoreNewsletters, pruneOldNewsletters } from "./gmail/index.js";
import { listRemindersSafe } from "./google/tasks.js";
import { isGoogleConfigured } from "./google/auth.js";
import { pruneOldReminderNotifications } from "./reminders/notifications.js";
import { checkAndSummarizeNewIpos } from "./ipos/checkNewIpos.js";
import { checkFollowedCompanyUpdates } from "./ipos/followedCompanies.js";

export interface BriefMessage {
  text: string;
  parseMode?: "HTML";
}

export async function buildBriefMessages(): Promise<BriefMessage[]> {
  const settings = await loadSettings();
  const [calendarResult, feedItems, watchlistEntries, ipoFilings, followedUpdates] = await Promise.all([
    getTodaysEvents(settings.timezone),
    fetchFeedItems(),
    getWatchlistEntries(),
    // Independent of the news/calendar pipeline, so it runs alongside
    // rather than after — a fetch/summarize failure never blocks the
    // rest of the brief.
    settings.briefConfig.ipos ? checkAndSummarizeNewIpos().catch(() => []) : Promise.resolve([]),
    settings.briefConfig.ipos ? checkFollowedCompanyUpdates().catch(() => []) : Promise.resolve([]),
  ]);
  const unseenItems = await filterUnseen(feedItems);
  const curated = await curateStories(
    unseenItems,
    watchlistEntries.map((e) => e.label)
  );
  // Attach the image and original publish date from the feed item rather
  // than trusting the model to pass them through unchanged.
  const imageByUrl = new Map(unseenItems.map((item) => [item.link, item.imageUrl]));
  const publishedAtByUrl = new Map(unseenItems.map((item) => [item.link, item.publishedAt.toISOString()]));
  const stories = curated.map((story) => ({
    ...story,
    imageUrl: imageByUrl.get(story.url),
    publishedAt: publishedAtByUrl.get(story.url),
  }));
  await markSeen(stories.map((s) => s.url));
  await pruneOldSeen();
  await pruneOldChatMessages();
  await pruneOldDailyContext();
  await pruneOldNewsletters();
  await pruneOldReminderNotifications();

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
  const day = localDateKey(new Date(), calendarResult.timezone);
  // Only worth tracking "held back" stories when headlines are actually
  // being texted — otherwise nobody was ever shown a "want more?" prompt,
  // and the pending row would just sit there ready to swallow the next
  // unrelated yes/no reply Donna gets asked in chat.
  if (settings.briefConfig.news) {
    await storePendingStories(held);
  }
  await storeDailyContext({
    day,
    timezone: calendarResult.timezone,
    stories,
    events: calendarResult.events,
  });
  // No-ops until GOOGLE_* secrets are configured — safe to call unconditionally.
  await fetchAndStoreNewsletters(day, settings.newsletterQuery);
  const reminders = await listRemindersSafe();

  const { news, calendar, reminders: remindersEnabled } = settings.briefConfig;
  const messages: BriefMessage[] = [];

  if (news) {
    messages.push(...formatStoryMessages(shown));
  }

  messages.push({
    text: "Morning — brief's ready. Full summaries, images, and newsletters: https://command-center-navy-pi.vercel.app/donna",
  });

  if (calendar || remindersEnabled) {
    const blocks: string[] = [];
    if (calendar) blocks.push(`<b>Today's Calendar</b>\n${formatEvents(calendarResult)}`);
    if (remindersEnabled) blocks.push(`<b>Reminders</b>\n${formatReminders(reminders, isGoogleConfigured())}`);
    messages.push({ text: blocks.join("\n\n"), parseMode: "HTML" });
  }

  if (news) {
    messages.push(formatMorePrompt(held));
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

  return messages;
}
