import { EDGAR_USER_AGENT } from "./edgarFeed.js";

interface SecSubmissionsResponse {
  filings: {
    recent: { form: string[]; filingDate: string[] };
    files: { name: string }[];
  };
}

// Forms that indicate the company was already an SEC reporting entity
// before this S-1 — periodic reports, other registration statements,
// prospectus supplements. Deliberately excludes S-1/A (an amendment to
// THIS SAME registration, not evidence of prior unrelated activity) and
// administrative/ownership forms (Form 3/4/5, SC 13G) which insiders can
// sometimes file even around a genuine first-time IPO.
const REPORTING_COMPANY_FORMS = new Set([
  "10-K", "10-K/A", "10-Q", "10-Q/A", "8-K", "8-K/A",
  "S-3", "S-3ASR", "S-4", "S-8",
  "424B1", "424B2", "424B3", "424B4", "424B5",
  "DEF 14A", "DEFA14A", "6-K", "20-F", "40-F",
]);

// A company with SEC filing history predating this S-1 (periodic
// reports, other registrations) is already public and this filing is a
// follow-on "Add-on" raise, not a genuine first-time IPO. A company
// whose EDGAR history is empty (or only the S-1 itself/its own
// amendments/confidential drafts) is a real "Initial" listing.
export async function isNewListing(cik: string, beforeDate: string): Promise<boolean> {
  const cik10 = cik.padStart(10, "0");
  const response = await fetch(`https://data.sec.gov/submissions/CIK${cik10}.json`, {
    headers: { "User-Agent": EDGAR_USER_AGENT },
  });
  if (!response.ok) {
    throw new Error(`EDGAR submissions fetch error ${response.status} for CIK ${cik}`);
  }
  const data = (await response.json()) as SecSubmissionsResponse;

  // Filing history deep enough to spill into EDGAR's paginated archive
  // (beyond the couple thousand entries "recent" already holds) is
  // itself strong evidence of a long-reporting company, regardless of
  // what those older forms are.
  if (data.filings.files.length > 0) return false;

  const { form, filingDate } = data.filings.recent;
  const hasPriorReportingActivity = form.some((f, i) => REPORTING_COMPANY_FORMS.has(f) && filingDate[i] < beforeDate);
  return !hasPriorReportingActivity;
}
