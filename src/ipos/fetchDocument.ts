import { EDGAR_USER_AGENT } from "./edgarFeed.js";
import { stripHtml } from "../util/html.js";

interface EdgarDirectoryItem {
  name: string;
  size?: string | number;
}

// The primary S-1 document is virtually always the largest .htm file in
// the filing's directory (exhibits/consents/XBRL viewers are much
// smaller) — EDGAR's index.json doesn't label a document as "primary"
// the way the separate per-company submissions API does, so size is the
// most reliable signal available from this endpoint.
export async function fetchS1Text(cik: string, accessionNo: string): Promise<{ text: string; sourceUrl: string }> {
  const accessionNoPlain = accessionNo.replace(/-/g, "");
  const indexUrl = `https://www.sec.gov/Archives/edgar/data/${cik}/${accessionNoPlain}/index.json`;

  const indexResponse = await fetch(indexUrl, { headers: { "User-Agent": EDGAR_USER_AGENT } });
  if (!indexResponse.ok) {
    throw new Error(`EDGAR index fetch error ${indexResponse.status} for ${indexUrl}`);
  }
  const indexData = (await indexResponse.json()) as { directory?: { item?: EdgarDirectoryItem[] } };
  const items = indexData.directory?.item ?? [];

  const htmlItems = items.filter(
    (item) => item.name.toLowerCase().endsWith(".htm") && !item.name.toLowerCase().endsWith("-index.htm")
  );
  if (htmlItems.length === 0) {
    throw new Error(`No primary document found in filing directory ${indexUrl}`);
  }

  // Exhibits conventionally start with "ex" (ex10, ex21, ex23, ex99...) —
  // excluding them from the candidate pool first means even a filing
  // whose directory listing has no usable size data doesn't silently
  // degrade to "whichever item happens to come first."
  const EXHIBIT_PREFIX_RE = /^ex\d/i;
  const nonExhibitItems = htmlItems.filter((item) => !EXHIBIT_PREFIX_RE.test(item.name));
  const candidates = nonExhibitItems.length > 0 ? nonExhibitItems : htmlItems;

  const primaryDoc = candidates.reduce((largest, item) =>
    Number(item.size ?? 0) > Number(largest.size ?? 0) ? item : largest
  );

  const docUrl = `https://www.sec.gov/Archives/edgar/data/${cik}/${accessionNoPlain}/${primaryDoc.name}`;
  const docResponse = await fetch(docUrl, { headers: { "User-Agent": EDGAR_USER_AGENT } });
  if (!docResponse.ok) {
    throw new Error(`EDGAR document fetch error ${docResponse.status} for ${docUrl}`);
  }
  const html = await docResponse.text();
  return { text: stripHtml(html), sourceUrl: docUrl };
}
