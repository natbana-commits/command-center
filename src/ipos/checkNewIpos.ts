import { fetchNewS1Entries } from "./edgarFeed.js";
import { fetchS1Text } from "./fetchDocument.js";
import { buildDigest } from "./digest.js";
import { summarizeS1 } from "./summarize.js";
import { getProcessedAccessions, saveIpoFiling, type IpoFiling } from "./store.js";

// Bounds worst-case run time inside the daily cron — ~4 original S-1
// filings/day on average observed against the live feed, so this cap is
// unlikely to actually bind; if a burst day exceeds it, the rest simply
// get picked up the next run since accession-number dedup means nothing
// is lost, just delayed.
const MAX_PER_RUN = 5;

// Callable synchronously outside the daily batch — a single filing's
// full fetch→digest→summarize→save, used by Stage 2's on-demand chat
// lookup for a company the daily poll hasn't (yet) caught.
export async function summarizeCompanyOnDemand(
  cik: string,
  accessionNo: string,
  companyName: string,
  filedDate: string
): Promise<IpoFiling> {
  const { text, sourceUrl } = await fetchS1Text(cik, accessionNo);
  const digest = buildDigest(text);
  const summary = await summarizeS1(digest, companyName);
  return saveIpoFiling({ accessionNo, cik, companyName, filedDate, sourceUrl, summary });
}

export async function checkAndSummarizeNewIpos(): Promise<IpoFiling[]> {
  const entries = await fetchNewS1Entries();
  const processed = await getProcessedAccessions(entries.map((e) => e.accessionNo));
  const unprocessed = entries.filter((e) => !processed.has(e.accessionNo)).slice(0, MAX_PER_RUN);

  const results: IpoFiling[] = [];
  for (const entry of unprocessed) {
    try {
      const filing = await summarizeCompanyOnDemand(entry.cik, entry.accessionNo, entry.companyName, entry.filedDate);
      results.push(filing);
    } catch (err) {
      // A single filing's failure (a fetch error, a bad Claude response)
      // shouldn't drop the rest of the batch or the whole daily brief.
      console.error(`Failed to process IPO filing ${entry.accessionNo} (${entry.companyName}):`, err);
    }
  }
  return results;
}
