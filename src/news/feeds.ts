import Parser from "rss-parser";

export interface FeedItem {
  title: string;
  link: string;
  snippet: string;
  source: string;
  publishedAt: Date;
  imageUrl?: string;
}

interface MediaContentField {
  $?: { url?: string; medium?: string };
}

const FEEDS = [
  { url: "https://feeds.content.dowjones.io/public/rss/RSSMarketsMain", source: "WSJ" },
  { url: "https://www.ft.com/markets?format=rss", source: "FT" },
  { url: "https://feeds.bloomberg.com/markets/news.rss", source: "Bloomberg" },
  { url: "https://feeds.content.dowjones.io/public/rss/mw_topstories", source: "MarketWatch" },
  { url: "https://www.cnbc.com/id/10001147/device/rss/rss.html", source: "CNBC" },
  { url: "https://seekingalpha.com/market_currents.xml", source: "Seeking Alpha" },
];

const parser: Parser<unknown, { mediaContent?: MediaContentField }> = new Parser({
  customFields: {
    item: [["media:content", "mediaContent"]],
  },
});

export async function fetchFeedItems(): Promise<FeedItem[]> {
  const results = await Promise.allSettled(
    FEEDS.map(async (feed) => {
      const parsed = await parser.parseURL(feed.url);
      return (parsed.items ?? [])
        .filter((item) => item.title && item.link)
        .map((item) => ({
          title: item.title!,
          link: item.link!,
          snippet: (item.contentSnippet ?? item.content ?? "").trim(),
          source: feed.source,
          publishedAt: item.isoDate ? new Date(item.isoDate) : new Date(),
          imageUrl: item.mediaContent?.$?.url,
        }));
    })
  );

  const items: FeedItem[] = [];
  results.forEach((result, i) => {
    if (result.status === "fulfilled") {
      items.push(...result.value);
    } else {
      console.error(`Failed to fetch ${FEEDS[i].source} feed:`, result.reason);
    }
  });

  return items;
}
