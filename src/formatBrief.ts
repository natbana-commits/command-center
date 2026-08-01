import { loadSettings } from "./config.js";
import { formatReminders } from "./reminders.js";
import { getTodaysEvents, formatEvents } from "./calendar.js";
import { fetchFeedItems } from "./news/feeds.js";
import { curateStories } from "./news/curate.js";
import { formatStoryMessages, formatMorePrompt } from "./news/format.js";
import { filterUnseen, markSeen, pruneOldSeen } from "./news/dedup.js";
import { storePendingStories } from "./news/pending.js";
import { storeDailyContext, pruneOldDailyContext } from "./chat/dailyContext.js";
import { pruneOldChatMessages } from "./chat/history.js";
import { localDateKey } from "./util/time.js";
import { fetchAndStoreNewsletters, pruneOldNewsletters } from "./gmail/index.js";
import { listRemindersSafe } from "./google/tasks.js";
import { isGoogleConfigured } from "./google/auth.js";
import { pruneOldReminderNotifications } from "./reminders/notifications.js";

export interface BriefMessage {
  text: string;
  parseMode?: "HTML";
}

export async function buildBriefMessages(): Promise<BriefMessage[]> {
  const settings = await loadSettings();
  const [calendarResult, feedItems] = await Promise.all([
    getTodaysEvents(settings.timezone),
    fetchFeedItems(),
  ]);
  const unseenItems = await filterUnseen(feedItems);
  const curated = await curateStories(unseenItems);
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
  const sorted = [...stories].sort((a, b) => b.relevance - a.relevance);
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

  return messages;
}
