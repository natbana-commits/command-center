import Parser from "rss-parser";
import { getSupabaseClient, withSupabaseRetry } from "../supabaseClient.js";
import { getOrFetch } from "../util/cache.js";

export interface CommunityFeedSource {
  id: number;
  url: string;
  label: string;
}

// publishedAt stays an ISO string (not a Date) end-to-end — the cached
// result round-trips through jsonb storage in getOrFetch, which would
// silently downgrade a Date back to a plain string on the next read anyway
// (same reasoning as calendar.ts caching raw ICS text rather than parsed
// VEVENTs with non-serializable fields).
export interface CommunityFeedItem {
  title: string;
  link: string;
  source: string;
  publishedAt: string;
}

const parser = new Parser();

export async function getCommunityFeedSources(): Promise<CommunityFeedSource[]> {
  const client = getSupabaseClient();
  const { data, error } = await withSupabaseRetry(() =>
    client.from("community_feed_sources").select("id, url, label").order("created_at", { ascending: true })
  );

  if (error) {
    if (error.code === "PGRST205") return [];
    throw new Error(`Supabase read error: ${error.message}`);
  }
  return data ?? [];
}

// This URL is fetched server-side (fetchOneFeed → parser.parseURL) on a
// schedule with no further review — rejecting non-http(s) schemes and
// obviously-internal/private hosts here (rather than trusting the caller)
// closes the server-side-request-forgery angle at the one place that
// actually issues the request, not just at today's single entry point.
export function isSafeFeedUrl(rawUrl: string): boolean {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;

  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host === "0.0.0.0") return false;

  // IPv4 literal checks: loopback, private ranges (RFC 1918), and
  // link-local (RFC 3927 — this range also covers the 169.254.169.254
  // cloud-metadata endpoint AWS/GCP/Azure all use).
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
    if (a === 127 || a === 10 || a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
  }

  // IPv6 literal checks: loopback, unique-local, and link-local.
  // url.hostname keeps the brackets for an IPv6 literal (e.g. "[fe80::1]"),
  // so match against the address with them stripped rather than the raw
  // hostname — a bare startsWith("fc") etc. against "[fc00::1]" would
  // never match and silently let every IPv6 unique-local/link-local
  // address through.
  const ipv6 = host.startsWith("[") && host.endsWith("]") ? host.slice(1, -1) : null;
  if (ipv6 && (ipv6 === "::1" || ipv6.startsWith("fc") || ipv6.startsWith("fd") || ipv6.startsWith("fe80:"))) {
    return false;
  }

  return true;
}

export async function addCommunityFeedSource(url: string, label: string): Promise<void> {
  const client = getSupabaseClient();
  const { error } = await withSupabaseRetry(() => client.from("community_feed_sources").insert({ url, label }));

  if (error) {
    throw new Error(`Supabase insert error: ${error.message}`);
  }
}

export async function deleteCommunityFeedSource(id: number): Promise<void> {
  const client = getSupabaseClient();
  const { error } = await withSupabaseRetry(() => client.from("community_feed_sources").delete().eq("id", id));

  if (error) {
    throw new Error(`Supabase delete error: ${error.message}`);
  }
}

async function fetchOneFeed(source: CommunityFeedSource): Promise<CommunityFeedItem[]> {
  const parsed = await parser.parseURL(source.url);
  return (parsed.items ?? [])
    .filter((item) => item.title && item.link)
    .map((item) => ({
      title: item.title!,
      link: item.link!,
      source: source.label,
      publishedAt: (item.isoDate ? new Date(item.isoDate) : new Date()).toISOString(),
    }));
}

// 15-minute cache — a raw chronological list, deliberately with no Claude
// curation/summarization pass, keeping this at effectively zero marginal
// API cost regardless of how often Home is loaded.
export async function getCommunityFeedItems(limit = 20): Promise<CommunityFeedItem[]> {
  const sources = await getCommunityFeedSources();
  if (sources.length === 0) return [];

  const items = await getOrFetch("community-feed-items", 900, async () => {
    const results = await Promise.allSettled(sources.map(fetchOneFeed));
    const all: CommunityFeedItem[] = [];
    results.forEach((result, i) => {
      if (result.status === "fulfilled") {
        all.push(...result.value);
      } else {
        console.error(`Failed to fetch community feed ${sources[i].label}:`, result.reason);
      }
    });
    all.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
    return all;
  });

  return items.slice(0, limit);
}
