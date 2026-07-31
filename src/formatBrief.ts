import { loadSettings } from "./config.js";
import { formatReminders } from "./reminders.js";
import { getTodaysEvents, formatEvents } from "./calendar.js";
import { fetchFeedItems } from "./news/feeds.js";
import { curateStories } from "./news/curate.js";
import { formatStoryMessages, formatMorePrompt } from "./news/format.js";
import { filterUnseen, markSeen, pruneOldSeen } from "./news/dedup.js";
import { storePendingStories } from "./news/pending.js";
import { storeDailyContext } from "./chat/dailyContext.js";
import { localDateKey } from "./util/time.js";

const HEADLINE_COUNT = 4;

export interface BriefMessage {
  text: string;
  parseMode?: "HTML";
}

export async function buildBriefMessages(): Promise<BriefMessage[]> {
  const settings = loadSettings();
  const [calendarResult, feedItems] = await Promise.all([
    getTodaysEvents(settings.timezone),
    fetchFeedItems(),
  ]);
  const unseenItems = await filterUnseen(feedItems);
  const stories = await curateStories(unseenItems);
  await markSeen(stories.map((s) => s.url));
  await pruneOldSeen();

  const sorted = [...stories].sort((a, b) => b.relevance - a.relevance);
  const shown = sorted.slice(0, HEADLINE_COUNT);
  const held = sorted.slice(HEADLINE_COUNT);
  await storePendingStories(held);
  await storeDailyContext({
    day: localDateKey(new Date(), calendarResult.timezone),
    timezone: calendarResult.timezone,
    stories,
    events: calendarResult.events,
    reminders: settings.reminders,
  });

  return [
    ...formatStoryMessages(shown),
    {
      text: "Morning — brief's ready. Once Donna's built, newsletters and extra stories will live there too.",
    },
    {
      text: [
        "<b>Today's Calendar</b>",
        formatEvents(calendarResult),
        "",
        "<b>Reminders</b>",
        formatReminders(settings),
      ].join("\n"),
      parseMode: "HTML",
    },
    formatMorePrompt(held),
  ];
}
