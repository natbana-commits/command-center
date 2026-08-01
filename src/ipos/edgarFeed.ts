// SEC EDGAR requires a descriptive User-Agent identifying the requester
// on every request (confirmed against SEC's official developer FAQ) —
// used on every fetch in this module and fetchDocument.ts.
export const EDGAR_USER_AGENT = "Donna (personal use) nathanielabanos@gmail.com";

export interface EdgarFilingEntry {
  companyName: string;
  cik: string;
  accessionNo: string;
  formType: string;
  filedDate: string;
  indexUrl: string;
}

// EDGAR's Atom feeds (both the "current filings" feed and the
// per-company "getcompany" search) render entries in the same shape:
//   <entry>
//     <title>S-1 - DATA I/O CORP (0000351998) (Filer)</title>
//     <link href="https://www.sec.gov/Archives/edgar/data/{cik}/{accNo}-index.htm"/>
//     <summary type="html">&lt;b&gt;Filed:&lt;/b&gt; 2026-07-31 &lt;b&gt;AccNo:&lt;/b&gt; 0001193125-26-328766 ...</summary>
//     <category term="S-1"/>
//   </entry>
// Hand-parsed via regex (no XML dependency, matching this repo's
// existing hand-rolled-parser style elsewhere) — skips any entry missing
// a required field rather than throwing, since a single malformed entry
// shouldn't break the whole poll.
function parseAtomEntries(xml: string): EdgarFilingEntry[] {
  const entries: EdgarFilingEntry[] = [];
  const entryBlocks = xml.match(/<entry>[\s\S]*?<\/entry>/g) ?? [];

  for (const block of entryBlocks) {
    const titleMatch = block.match(/<title>([^<]*)<\/title>/);
    const linkMatch = block.match(/<link[^>]*href="([^"]+)"/);
    const categoryMatch = block.match(/<category term="([^"]+)"/);
    const filedMatch = block.match(/Filed:[^0-9]*(\d{4}-\d{2}-\d{2})/);
    const accNoMatch = block.match(/AccNo:[^0-9]*(\d{10}-\d{2}-\d{6})/);
    const cikMatch = linkMatch?.[1].match(/\/data\/(\d+)\//);

    if (!titleMatch || !linkMatch || !categoryMatch || !filedMatch || !accNoMatch || !cikMatch) {
      continue;
    }

    const companyMatch = titleMatch[1].match(/^\S+\s*-\s*(.+?)\s*\(\d+\)\s*\(Filer\)\s*$/i);
    if (!companyMatch) continue;

    entries.push({
      companyName: companyMatch[1].trim(),
      cik: cikMatch[1],
      accessionNo: accNoMatch[1],
      formType: categoryMatch[1],
      filedDate: filedMatch[1],
      indexUrl: linkMatch[1],
    });
  }

  return entries;
}

async function fetchAtomFeed(url: string): Promise<EdgarFilingEntry[]> {
  const response = await fetch(url, { headers: { "User-Agent": EDGAR_USER_AGENT } });
  if (!response.ok) {
    throw new Error(`EDGAR fetch error ${response.status} for ${url}`);
  }
  return parseAtomEntries(await response.text());
}

// Only the initial S-1 registration counts as "a new IPO" — S-1/A
// amendments (there can be several per deal as the SEC reviews and
// pricing firms up) are deliberately excluded here. Following a specific
// company (src/ipos/followedCompanies.ts) is the intended path for
// catching those later filings.
export async function fetchNewS1Entries(): Promise<EdgarFilingEntry[]> {
  const url =
    "https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=S-1&company=&dateb=&owner=include&count=100&output=atom";
  const entries = await fetchAtomFeed(url);
  return entries.filter((e) => e.formType === "S-1");
}

// Live company-name search, used both for an on-demand chat lookup of a
// company not caught by the daily poll and for resolving a company name
// to a CIK when following it.
export async function searchCompanyFilings(companyName: string): Promise<EdgarFilingEntry[]> {
  const url = `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&company=${encodeURIComponent(
    companyName
  )}&type=S-1&dateb=&owner=include&count=40&output=atom`;
  return fetchAtomFeed(url);
}
