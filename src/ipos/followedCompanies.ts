import { getSupabaseClient, withSupabaseRetry } from "../supabaseClient.js";
import { EDGAR_USER_AGENT } from "./edgarFeed.js";
import { summarizeCompanyOnDemand } from "./checkNewIpos.js";
import type { IpoFiling } from "./store.js";

export interface FollowedCompany {
  id: number;
  cik: string;
  companyName: string;
  ticker: string | null;
  lastSeenAccession: string | null;
}

function rowToFollowed(row: {
  id: number;
  cik: string;
  company_name: string;
  ticker: string | null;
  last_seen_accession: string | null;
}): FollowedCompany {
  return {
    id: row.id,
    cik: row.cik,
    companyName: row.company_name,
    ticker: row.ticker,
    lastSeenAccession: row.last_seen_accession,
  };
}

export async function getFollowedCompanies(): Promise<FollowedCompany[]> {
  const client = getSupabaseClient();
  const { data, error } = await withSupabaseRetry(() =>
    client
      .from("followed_companies")
      .select("id, cik, company_name, ticker, last_seen_accession")
      .order("company_name", { ascending: true })
  );

  if (error) {
    if (error.code === "PGRST205") return [];
    throw new Error(`Supabase read error: ${error.message}`);
  }
  return (data ?? []).map(rowToFollowed);
}

export async function followCompany(cik: string, companyName: string, ticker?: string): Promise<void> {
  const client = getSupabaseClient();
  const { error } = await withSupabaseRetry(() =>
    client
      .from("followed_companies")
      .upsert({ cik, company_name: companyName, ticker: ticker || null }, { onConflict: "cik" })
  );

  if (error) {
    throw new Error(`Supabase insert error: ${error.message}`);
  }
}

export async function unfollowCompany(cik: string): Promise<void> {
  const client = getSupabaseClient();
  const { error } = await withSupabaseRetry(() => client.from("followed_companies").delete().eq("cik", cik));

  if (error) {
    throw new Error(`Supabase delete error: ${error.message}`);
  }
}

async function updateLastSeenAccession(cik: string, accessionNo: string): Promise<void> {
  const client = getSupabaseClient();
  const { error } = await withSupabaseRetry(() =>
    client.from("followed_companies").update({ last_seen_accession: accessionNo }).eq("cik", cik)
  );

  if (error) {
    throw new Error(`Supabase update error: ${error.message}`);
  }
}

interface EdgarSubmissions {
  filings?: {
    recent?: {
      accessionNumber: string[];
      filingDate: string[];
      form: string[];
    };
  };
}

export interface FollowedCompanyUpdate {
  company: FollowedCompany;
  filing: IpoFiling;
}

async function checkOneCompany(company: FollowedCompany): Promise<FollowedCompanyUpdate | null> {
  const cikPadded = company.cik.padStart(10, "0");
  const response = await fetch(`https://data.sec.gov/submissions/CIK${cikPadded}.json`, {
    headers: { "User-Agent": EDGAR_USER_AGENT },
  });
  if (!response.ok) {
    console.error(`EDGAR submissions fetch failed for ${company.companyName} (${response.status})`);
    return null;
  }

  const data = (await response.json()) as EdgarSubmissions;
  const recent = data.filings?.recent;
  if (!recent || recent.accessionNumber.length === 0) return null;

  const newestAccession = recent.accessionNumber[0];
  if (newestAccession === company.lastSeenAccession) return null;

  // First check for a newly-followed company: just record today's
  // newest filing as the baseline rather than summarizing the whole
  // pre-existing history.
  if (!company.lastSeenAccession) {
    await updateLastSeenAccession(company.cik, newestAccession);
    return null;
  }

  let update: FollowedCompanyUpdate | null = null;
  try {
    const filing = await summarizeCompanyOnDemand(
      company.cik,
      newestAccession,
      company.companyName,
      recent.filingDate[0]
    );
    update = { company, filing };
  } catch (err) {
    // An unreadable filing (e.g. an unusual document format) still
    // advances the cursor below rather than retrying it forever — the
    // company's page history isn't lost, just this one snapshot's
    // summary.
    console.error(`Failed to summarize update for ${company.companyName}:`, err);
  }

  await updateLastSeenAccession(company.cik, newestAccession);
  return update;
}

// Checks every followed company's full filing history (any form type,
// not just S-1 — an S-1/A amendment or the eventual 424B4 pricing
// prospectus both matter to someone following the deal) for anything
// newer than last_seen_accession, and summarizes the newest one found.
// Runs concurrently — this shares a request budget with the main daily
// IPO check and the rest of the morning brief, so N companies checked
// one-at-a-time would multiply the time risk of losing the whole brief
// to a timeout.
export async function checkFollowedCompanyUpdates(): Promise<FollowedCompanyUpdate[]> {
  const followed = await getFollowedCompanies();

  const settled = await Promise.allSettled(followed.map((company) => checkOneCompany(company)));

  const results: FollowedCompanyUpdate[] = [];
  settled.forEach((outcome, i) => {
    if (outcome.status === "fulfilled") {
      if (outcome.value) results.push(outcome.value);
    } else {
      console.error(`Failed to check updates for ${followed[i].companyName}:`, outcome.reason);
    }
  });
  return results;
}
