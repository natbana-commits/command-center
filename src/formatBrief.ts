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
import { fetchAndStoreNewsletters } from "./gmail/index.js";
import { listRemindersSafe } from "./google/tasks.js";
import { isGoogleConfigured } from "./google/auth.js";

const HEADLINE_COUNT = 4;

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
  // Attach the image from the original feed item rather than trusting the
  // model to pass it through unchanged.
  const imageByUrl = new Map(unseenItems.map((item) => [item.link, item.imageUrl]));
  const stories = curated.map((story) => ({ ...story, imageUrl: imageByUrl.get(story.url) }));
  await markSeen(stories.map((s) => s.url));
  await pruneOldSeen();
  await pruneOldChatMessages();
  await pruneOldDailyContext();

  const sorted = [...stories].sort((a, b) => b.relevance - a.relevance);
  const shown = sorted.slice(0, HEADLINE_COUNT);
  const held = sorted.slice(HEADLINE_COUNT);
  const day = localDateKey(new Date(), calendarResult.timezone);
  await storePendingStories(held);
  await storeDailyContext({
    day,
    timezone: calendarResult.timezone,
    stories,
    events: calendarResult.events,
  });
  // No-ops until GOOGLE_* secrets are configured — safe to call unconditionally.
  await fetchAndStoreNewsletters(day, settings.newsletterQuery);
  const reminders = await listRemindersSafe();

  return [
    ...formatStoryMessages(shown),
    {
      text: "Morning — brief's ready. Full summaries, images, and newsletters: https://command-center-navy-pi.vercel.app/donna",
    },
    {
      text: [
        "<b>Today's Calendar</b>",
        formatEvents(calendarResult),
        "",
        "<b>Reminders</b>",
        formatReminders(reminders, isGoogleConfigured()),
      ].join("\n"),
      parseMode: "HTML",
    },
    formatMorePrompt(held),
  ];
}
